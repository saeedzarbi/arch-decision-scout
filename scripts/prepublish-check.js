#!/usr/bin/env node
/**
 * Sanity check before npm publish: scan demo fixture and assert expected signals.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runScan } from "../lib/scan.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "fixture", "sample_app");

const decisions = runScan(fixture);
if (decisions.length !== 9) {
  console.error(`Expected 9 decisions, got ${decisions.length}`);
  process.exit(1);
}

const drifted = decisions.filter((d) => d.assessment === "likely_drifted");
const legacyRule = decisions.find((d) => d.decision_id === "rule:app.legacy");
if (!legacyRule || legacyRule.assessment !== "likely_drifted") {
  console.error("Expected rule:app.legacy to be likely_drifted");
  process.exit(1);
}
if (!drifted.some((d) => d.notes?.includes("app/api/handlers.py"))) {
  console.error("Expected handlers.py in drift notes");
  process.exit(1);
}

console.log("prepublish-check: ok (9 decisions, app.legacy drift detected)");
