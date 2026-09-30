import { resolve } from "node:path";
import { createServer } from "node:net";
import manifest from "../package.json";
import {
  draftgapRepo,
  lolmixRepo,
  requireRepositories,
  run,
} from "./lib/cross-repo";

requireRepositories();
const requiredBun = manifest.packageManager.replace("bun@", "");
if (Bun.version !== requiredBun) {
  throw new Error(
    `Use Bun ${requiredBun} from packageManager; found ${Bun.version}.`,
  );
}
const bun = process.execPath;
const frontend = resolve(draftgapRepo, "apps/frontend");
const action = process.argv[2];

if (action === "setup") {
  run(["uv", "sync", "--locked", "--all-extras"], lolmixRepo);
  run([bun, "install", "--frozen-lockfile"], draftgapRepo);
} else if (action === "check") {
  for (const repo of [lolmixRepo, draftgapRepo]) {
    run(
      [
        "git",
        "-c",
        `safe.directory=${repo.replaceAll("\\", "/")}`,
        "rev-parse",
        "HEAD",
      ],
      repo,
    );
  }
  const checks: [string[], string][] = [
    [["uv", "run", "--locked", "pytest"], lolmixRepo],
    [["uv", "run", "--locked", "ruff", "check", "."], lolmixRepo],
    [["uv", "run", "--locked", "ruff", "format", "--check", "."], lolmixRepo],
    [
      [
        "uv",
        "run",
        "--locked",
        "ruff",
        "check",
        resolve(import.meta.dir, "integration/lolmix-contract-server.py"),
      ],
      lolmixRepo,
    ],
    [
      [
        "uv",
        "run",
        "--locked",
        "ruff",
        "format",
        "--check",
        resolve(import.meta.dir, "integration/lolmix-contract-server.py"),
      ],
      lolmixRepo,
    ],
    [[bun, "run", "typecheck"], draftgapRepo],
    [
      [bun, "run", "typecheck", "--project", "../../scripts/tsconfig.json"],
      frontend,
    ],
    [[bun, "run", "test"], frontend],
    [[bun, "run", "lint"], frontend],
    [[bun, "run", "build"], frontend],
    [[bun, "run", "test:integration"], draftgapRepo],
    [
      [
        "uv",
        "run",
        "--locked",
        "ruff",
        "check",
        resolve(import.meta.dir, "lib/lolmix-service.py"),
      ],
      lolmixRepo,
    ],
    [
      [
        "uv",
        "run",
        "--locked",
        "ruff",
        "format",
        "--check",
        resolve(import.meta.dir, "lib/lolmix-service.py"),
      ],
      lolmixRepo,
    ],
  ];
  const failures: unknown[] = [];
  for (const [command, cwd] of checks) {
    try {
      run(command, cwd);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      `${failures.length} validation command(s) failed; see output above.`,
    );
} else if (action === "dev") {
  for (const port of [8765, 3000]) {
    await new Promise<void>((resolve, reject) => {
      const probe = createServer();
      probe.once("error", () =>
        reject(
          new Error(
            `127.0.0.1:${port} is in use; stop your own service or use a separate task.`,
          ),
        ),
      );
      probe.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
        probe.close(() => resolve()),
      );
    });
  }
  const children: ReturnType<typeof Bun.spawn>[] = [];
  let server: Bun.Subprocess<"pipe", "inherit", "inherit"> | undefined;
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    if (server?.exitCode === null) server.stdin.end();
    for (const child of children) {
      if (child !== server && child.exitCode === null) child.kill();
    }
  };
  const stopOnInput = (text: Buffer) => {
    if (text.toString().trim() === "stop") stop();
  };
  process.stdin.on("data", stopOnInput);
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    server = Bun.spawn(
      [
        "uv",
        "run",
        "--locked",
        "--no-sync",
        "python",
        resolve(import.meta.dir, "lib/lolmix-service.py"),
      ],
      { cwd: lolmixRepo, stdin: "pipe", stdout: "inherit", stderr: "inherit" },
    );
    children.push(server);
    let ready = false;
    for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
      if (server.exitCode !== null)
        throw new Error("LoLMix server exited before becoming ready.");
      try {
        const response = await fetch("http://127.0.0.1:8765/health", {
          signal: AbortSignal.timeout(500),
        });
        const health = await response.json();
        ready =
          response.ok &&
          typeof health === "object" &&
          health !== null &&
          "app" in health &&
          health.app === "lolmix" &&
          "schema_version" in health &&
          health.schema_version === 1;
      } catch {
        /* The owned server is still starting. */
      }
      if (ready) break;
      await Bun.sleep(100);
    }
    if (!ready)
      throw new Error("LoLMix did not become ready on 127.0.0.1:8765.");
    const web = Bun.spawn(
      [
        bun,
        resolve(frontend, "node_modules/vite/bin/vite.js"),
        "--host",
        "127.0.0.1",
        "--port",
        "3000",
        "--strictPort",
      ],
      {
        cwd: frontend,
        stdout: "inherit",
        stderr: "inherit",
        env: { ...process.env, npm_package_version: manifest.version },
      },
    );
    children.push(web);
    let webReady = false;
    for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
      if (web.exitCode !== null)
        throw new Error("Vite exited before becoming ready.");
      try {
        webReady = (
          await fetch("http://127.0.0.1:3000", {
            signal: AbortSignal.timeout(500),
          })
        ).ok;
      } catch {
        /* Vite is still starting. */
      }
      if (webReady) break;
      await Bun.sleep(100);
    }
    if (!webReady)
      throw new Error("Vite did not become ready on 127.0.0.1:3000.");
    console.log(
      "LoLMix is ready at http://127.0.0.1:8765; Vite is ready at http://127.0.0.1:3000.",
    );
    const code = await Promise.race(children.map((child) => child.exited));
    if (!stopping && code !== 0)
      throw new Error(`Development service exited (${code}).`);
  } finally {
    stop();
    await Promise.all(children.map((child) => child.exited));
    process.stdin.off("data", stopOnInput);
    process.stdin.pause();
  }
} else {
  throw new Error("Usage: bun scripts/cross-repo.ts setup|check|dev");
}
