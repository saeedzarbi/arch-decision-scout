import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatReport, runScan } from "./scan.js";

export function runCli(argv) {
  const args = argv.slice(2);
  const json = args.includes("--json");
  const positional = args.filter((a) => a !== "--json");

  if (!positional.length) {
    console.error("Usage: arch-decision-scout <path> [--json]");
    process.exit(2);
  }

  const target = path.resolve(positional[0]);
  let decisions;
  try {
    decisions = runScan(target);
  } catch (err) {
    console.error(err.message || String(err));
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify(decisions, null, 2));
    return;
  }
  console.log(formatReport(target, decisions));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli(process.argv);
}
