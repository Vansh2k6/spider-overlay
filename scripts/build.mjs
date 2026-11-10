import { execFileSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const project = new URL("../", import.meta.url);
const source = new URL("src/", project);
const output = new URL("dist/", project);

// A clean build keeps removed files out of the tarball.
await rm(output, { recursive: true, force: true });
execFileSync(process.execPath, [fileURLToPath(import.meta.resolve("typescript/bin/tsc")), "-p", "tsconfig.json"],
  { cwd: fileURLToPath(project), stdio: "inherit" });
await mkdir(new URL("assets/", output), { recursive: true });
await Promise.all([
  cp(new URL("assets/spider/", source), new URL("assets/spider/", output), { recursive: true }),
  cp(new URL("overlay.css", source), new URL("overlay.css", output)),
]);
