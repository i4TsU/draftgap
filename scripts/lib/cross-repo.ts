import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const draftgapRepo = resolve(import.meta.dir, "../..");
export const lolmixRepo = resolve(
  process.env.LOLMIX_REPO ?? resolve(draftgapRepo, "../lolmix"),
);

export function requireRepositories() {
  for (const file of [
    resolve(draftgapRepo, "apps/frontend/package.json"),
    resolve(lolmixRepo, "pyproject.toml"),
    resolve(lolmixRepo, "uv.lock"),
  ]) {
    if (!existsSync(file)) {
      throw new Error(
        `Missing ${file}. Check out both repositories and set LOLMIX_REPO if they are not siblings.`,
      );
    }
  }
}

export function run(command: string[], cwd: string) {
  console.log(`\n${cwd}: ${command.join(" ")}`);
  const result = Bun.spawnSync(command, {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed (${result.exitCode}): ${command.join(" ")}`,
    );
  }
}
