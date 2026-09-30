import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createServer, connect } from "node:net";
import { lolmixRepo } from "../lib/cross-repo";
import { ownedSpawnOptions, stopOwned, within } from "../lib/owned-process";
import { waitReady } from "../lib/wait-ready";

async function fixture(mode: "cooperative" | "stubborn") {
  const child = Bun.spawn(
    [
      "uv",
      "run",
      "--locked",
      "--no-sync",
      "python",
      resolve(import.meta.dir, "process-fixture.py"),
      mode,
    ],
    {
      ...ownedSpawnOptions,
      cwd: lolmixRepo,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    },
  );
  const reader = child.stdout.getReader();
  let text = "";
  try {
    const address = await within(
      (async () => {
        while (!text.includes("\n")) {
          const next = await reader.read();
          if (next.done)
            throw new Error("Fixture exited before reporting its child.");
          text += new TextDecoder().decode(next.value);
        }
        return JSON.parse(text.split("\n")[0]!) as {
          pid: number;
          leaf: { pid: number; port: number };
        };
      })(),
      5000,
      "Fixture startup timed out.",
    );
    return { child, address, reader };
  } catch (error) {
    await stopOwned(child, () => child.stdin.end(), 50);
    reader.releaseLock();
    throw error;
  }
}

function listening(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(300, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    if (process.platform === "linux") {
      // Minimal containers may not reap orphaned grandchildren at PID 1.
      // kill(pid, 0) also succeeds for zombies, which have already exited.
      // Keep checking listeners separately so this cannot hide a live service.
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      if (stat.slice(stat.lastIndexOf(")") + 2).startsWith("Z ")) return false;
    }
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH" || code === "ENOENT") return false;
    throw error;
  }
}

async function gone(address: {
  pid: number;
  leaf: { pid: number; port: number };
}) {
  for (
    let i = 0;
    i < 30 && (alive(address.pid) || alive(address.leaf.pid));
    i++
  )
    await Bun.sleep(50);
  expect(alive(address.pid)).toBe(false);
  expect(alive(address.leaf.pid)).toBe(false);
  expect(await listening(address.leaf.port)).toBe(false);
}

test("cooperative shutdown is repeatable and reaps the uv/Python tree", async () => {
  const owned = await fixture("cooperative");
  try {
    expect(await listening(owned.address.leaf.port)).toBe(true);
    const first = stopOwned(owned.child, () => owned.child.stdin.end());
    expect(
      stopOwned(owned.child, () => {
        throw new Error("must not run twice");
      }),
    ).toBe(first);
    await first;
    await stopOwned(owned.child);
    await gone(owned.address);
  } finally {
    await stopOwned(owned.child);
    owned.reader.releaseLock();
  }
}, 10_000);

test("readiness failure escalates a stuck tree without stopping an unrelated listener", async () => {
  const unrelated = await fixture("cooperative");
  const owned = await fixture("stubborn");
  try {
    const started = performance.now();
    const readiness = owned.reader.read().then(() => {
      throw new Error("Unexpected readiness data");
    });
    const controller = new AbortController();
    try {
      await expect(
        waitReady(readiness, controller.signal, 50, "Expected startup timeout"),
      ).rejects.toThrow("Expected startup timeout");
    } finally {
      await stopOwned(owned.child, () => owned.child.stdin.end(), 50);
    }
    expect(performance.now() - started).toBeLessThan(6000);
    await gone(owned.address);
    expect(alive(unrelated.address.pid)).toBe(true);
    expect(alive(unrelated.address.leaf.pid)).toBe(true);
    expect(await listening(unrelated.address.leaf.port)).toBe(true);
  } finally {
    await Promise.all([
      stopOwned(owned.child),
      stopOwned(unrelated.child, () => unrelated.child.stdin.end()),
    ]);
    owned.reader.releaseLock();
    unrelated.reader.releaseLock();
  }
}, 15_000);

test("interrupting startup reports cancellation and leaves no owned processes or ports", async () => {
  const owned = await fixture("stubborn");
  const controller = new AbortController();
  try {
    const readiness = owned.reader.read().then(() => {
      throw new Error("Unexpected readiness data");
    });
    const waiting = waitReady(
      readiness,
      controller.signal,
      10_000,
      "Unexpected timeout",
    );
    controller.abort(new Error("Task interrupted"));
    await expect(waiting).rejects.toThrow("Task interrupted");
    await stopOwned(owned.child, () => owned.child.stdin.end(), 50);
    await gone(owned.address);
  } finally {
    await stopOwned(owned.child);
    owned.reader.releaseLock();
  }
}, 10_000);

test("a busy development port remains owned by the existing listener", async () => {
  const unrelated = createServer();
  await new Promise<void>((resolve) =>
    unrelated.listen(8765, "127.0.0.1", resolve),
  );
  try {
    const child = Bun.spawn(
      [process.execPath, resolve(import.meta.dir, "../cross-repo.ts"), "dev"],
      { cwd: lolmixRepo, stdin: "pipe", stdout: "pipe", stderr: "pipe" },
    );
    const code = await within(child.exited, 5000, "Busy-port check timed out");
    expect(code).not.toBe(0);
    expect(await new Response(child.stderr).text()).toContain("is in use");
    expect(await listening(8765)).toBe(true);
  } finally {
    await new Promise<void>((resolve) => unrelated.close(() => resolve()));
  }
}, 10_000);

test("nested package scripts keep the selected Bun runtime", async () => {
  const child = Bun.spawn(
    [process.execPath, "run", "--bun", "test:integration"],
    { cwd: resolve(import.meta.dir, "../.."), stdout: "pipe", stderr: "pipe" },
  );
  const [code, output, errors] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(code).toBe(0);
  expect(output + errors).toContain(`bun test v${Bun.version}`);
}, 15_000);
