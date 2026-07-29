import { spawnSync } from "node:child_process";

const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  encoding: "utf8",
  stdio: "pipe"
});

if (result.status !== 0) {
  const message = result.stderr.trim() || "Git-hooks kunde inte aktiveras.";
  console.warn(message);
  process.exitCode = 1;
} else {
  console.log("Git pre-push-kontroll aktiverad.");
}
