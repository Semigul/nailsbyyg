import { spawnSync } from "node:child_process";

const [, , project, ...flags] = process.argv;

if (!project) {
  console.error("Ange en undermapp att granska, till exempel: node scripts/check-subproject-audit.mjs functions");
  process.exit(1);
}

const omitDev = flags.includes("--omit-dev");
const auditArgs = ["--prefix", project, "audit", "--json"];

if (omitDev) {
  auditArgs.splice(3, 0, "--omit=dev");
}

const result = spawnSync("npm", auditArgs, {
  encoding: "utf8"
});

const output = `${result.stdout || ""}${result.stderr || ""}`.trim();

let report;

try {
  report = JSON.parse(result.stdout || "{}");
} catch {
  console.error(output || `Kunde inte tolka npm audit för ${project}.`);
  process.exit(result.status || 1);
}

const levels = report.metadata?.vulnerabilities || {};
const highCount = Number(levels.high || 0);
const criticalCount = Number(levels.critical || 0);

if (highCount > 0 || criticalCount > 0) {
  console.error(output || JSON.stringify(report, null, 2));
  process.exit(1);
}

const suffix = omitDev ? " (utan devDependencies)" : "";
console.log(`npm audit för ${project}${suffix} rapporterade inga sårbarheter på hög eller kritisk nivå.`);
