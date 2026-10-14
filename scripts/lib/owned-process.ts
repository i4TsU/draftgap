/** Shutdown is scoped to a child we spawned, never a port or executable name. */
export const ownedSpawnOptions = { detached: process.platform !== "win32" };

export async function within<T>(work: Promise<T>, ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

type Child = Pick<Bun.Subprocess, "pid" | "exitCode" | "exited">;
const stopping = new WeakMap<Child, Promise<void>>();

export function stopOwned(child: Child, graceful?: () => void, graceMs = 1500) {
  const pending = stopping.get(child);
  if (pending) return pending;
  const cleanup = async () => {
    if (child.exitCode !== null) return;
    if (graceful) {
      try {
        graceful();
      } catch {
        // A child may close its pipe while shutdown is requested.
      }
      try {
        await within(child.exited, graceMs, "Graceful shutdown timed out.");
        return;
      } catch {
        // Keep the uv parent alive until escalation can also stop its Python child.
      }
    }
    if (child.exitCode !== null) return;
    if (process.platform === "win32") {
      const result = Bun.spawnSync(
        ["taskkill.exe", "/PID", String(child.pid), "/T", "/F"],
        { stdout: "pipe", stderr: "pipe", timeout: 3000 },
      );
      if (result.exitCode !== 0 && child.exitCode === null)
        throw new Error(
          `Unable to stop owned process tree ${child.pid}: ${new TextDecoder().decode(result.stderr)}`,
        );
    } else {
      // Every owned child starts its own session/group; descendants share it.
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
    await within(
      child.exited,
      3000,
      `Owned process ${child.pid} did not exit.`,
    );
  };
  const result = cleanup();
  stopping.set(child, result);
  return result;
}
