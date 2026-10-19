import fs from "node:fs";
import path from "node:path";

const CODE_EXTENSIONS = new Set([
  ".py",
  ".ts",
  ".js",
  ".tsx",
  ".jsx",
  ".go",
  ".rs",
  ".java",
]);
const SKIP_DIRS = new Set([
  ".git",
  ".venv",
  "venv",
  "node_modules",
  "__pycache__",
  ".pytest_cache",
]);

const KEYWORD_RE = /\b(why|decided|chosen|tradeoff|trade-off|deprecated)\b/i;
const DECISION_PREFIX_RE =
  /(?:#\s*)?(?:ARCHITECTURE|DECISION|ADR)\s*[:\-]\s*(.+)/i;
const ADR_STATUS_RE = /^\s*status\s*:\s*(.+)$/im;
const FORBIDDEN_MODULE_RE =
  /(?:must not|do not|don't|never)\s+import\s+(?:from\s+)?[`'"]?((?:app\.)[\w.]+)[`'"]?/i;
const PY_FROM_RE = /^\s*from\s+([\w.]+)/;
const PY_IMPORT_RE = /^\s*import\s+([\w.]+)/;

export const Assessment = {
  STILL_HOLDS: "still_holds",
  UNCERTAIN: "uncertain",
  LIKELY_DRIFTED: "likely_drifted",
};

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function walkFiles(root, predicate) {
  const results = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(name.name)) continue;
      const full = path.join(dir, name.name);
      if (name.isDirectory()) walk(full);
      else if (predicate(full)) results.push(full);
    }
  }
  walk(root);
  return results.sort();
}

export function iterSourceFiles(root) {
  return walkFiles(root, (filePath) => {
    const ext = path.extname(filePath);
    return CODE_EXTENSIONS.has(ext);
  });
}

function relPath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

export function scanAdrs(root) {
  const adrDirs = [
    path.join(root, "docs", "adr"),
    path.join(root, "doc", "adr"),
    path.join(root, "architecture", "decisions"),
  ];
  const paths = [];
  for (const d of adrDirs) {
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
    for (const name of fs.readdirSync(d)) {
      if (name.endsWith(".md")) paths.push(path.join(d, name));
    }
  }
  paths.sort();

  const out = [];
  for (const filePath of paths) {
    const rel = relPath(root, filePath);
    const text = readText(filePath);
    let title = path.basename(filePath, ".md");
    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith("# ")) {
        title = line.slice(2).trim();
        break;
      }
    }
    let status = "";
    const statusM = ADR_STATUS_RE.exec(text);
    if (statusM) status = statusM[1].trim().toLowerCase();
    if (!status) {
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().toLowerCase() !== "## status") continue;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const cand = lines[j].trim().toLowerCase();
          if (cand) {
            status = cand;
            break;
          }
        }
        break;
      }
    }
    let assessment = Assessment.UNCERTAIN;
    let notes = "No clear status field in ADR.";
    if (["accepted", "active", "approved"].includes(status)) {
      assessment = Assessment.STILL_HOLDS;
      notes = `ADR status: ${status}`;
    } else if (["superseded", "deprecated", "rejected"].includes(status)) {
      assessment = Assessment.LIKELY_DRIFTED;
      notes = `ADR status: ${status}`;
    }
    const summary =
      text.slice(0, 200).replace(/\n/g, " ") + (text.length > 200 ? "…" : "");
    const firstLine = text.split(/\r?\n/)[0]?.slice(0, 120) ?? "";
    out.push({
      decision_id: `adr:${rel}`,
      title,
      kind: "adr",
      summary,
      evidence: [{ path: rel, line: 1, excerpt: firstLine }],
      assessment,
      notes,
    });
  }
  return out;
}

export function scanCommentMarkers(root) {
  const out = [];
  for (const filePath of iterSourceFiles(root)) {
    const rel = relPath(root, filePath);
    const lines = readText(filePath).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const stripped = lines[i].trim();
      if (!/^[#/*]/.test(stripped) && !stripped.startsWith("//")) continue;
      const prefix = DECISION_PREFIX_RE.exec(stripped);
      if (prefix) {
        const summary = prefix[1].trim();
        out.push({
          decision_id: `comment:${rel}:${lineNum}`,
          title: summary.slice(0, 72),
          kind: "explicit_comment",
          summary,
          evidence: [{ path: rel, line: lineNum, excerpt: stripped.slice(0, 160) }],
          assessment: Assessment.UNCERTAIN,
          notes: "Explicit ARCHITECTURE/DECISION comment; check imports below.",
        });
        continue;
      }
      if (KEYWORD_RE.test(stripped)) {
        out.push({
          decision_id: `keyword:${rel}:${lineNum}`,
          title: `Decision language at ${rel}:${lineNum}`,
          kind: "keyword_comment",
          summary: stripped.slice(0, 160),
          evidence: [{ path: rel, line: lineNum, excerpt: stripped.slice(0, 160) }],
          assessment: Assessment.UNCERTAIN,
          notes: "Comment contains decision-related keywords.",
        });
      }
    }
  }
  return out;
}

export function collectPythonImports(root) {
  const graph = {};
  for (const filePath of iterSourceFiles(root)) {
    if (path.extname(filePath) !== ".py") continue;
    const rel = relPath(root, filePath);
    const imps = new Set();
    for (const line of readText(filePath).split(/\r?\n/)) {
      const fromM = PY_FROM_RE.exec(line);
      if (fromM) imps.add(fromM[1]);
      const importM = PY_IMPORT_RE.exec(line);
      if (importM) imps.add(importM[1].split(".")[0]);
    }
    graph[rel] = imps;
  }
  return graph;
}

export function scanModuleStructure(root) {
  const app = path.join(root, "app");
  if (!fs.existsSync(app) || !fs.statSync(app).isDirectory()) return [];
  const packages = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      const full = path.join(dir, name.name);
      if (fs.existsSync(path.join(full, "__init__.py"))) {
        packages.push(relPath(root, full));
      }
      walk(full);
    }
  }
  walk(app);
  packages.sort();
  if (!packages.length) return [];
  return [
    {
      decision_id: "structure:app-packages",
      title: "Application package layout",
      kind: "module_structure",
      summary: `Detected packages under app/: ${packages.join(", ")}`,
      evidence: [{ path: "app/", line: null, excerpt: packages.join(", ") }],
      assessment: Assessment.UNCERTAIN,
      notes: "Layering rules should align with import graph.",
    },
  ];
}

export function scanDependencyRules(root, importGraph) {
  const out = [];
  const archPaths = [
    path.join(root, "ARCHITECTURE.md"),
    path.join(root, "docs", "ARCHITECTURE.md"),
  ];
  for (const arch of archPaths) {
    if (!fs.existsSync(arch) || !fs.statSync(arch).isFile()) continue;
    const rel = relPath(root, arch);
    const lines = readText(arch).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      const m = FORBIDDEN_MODULE_RE.exec(line);
      if (!m) continue;
      const forbidden = m[1].replace(/\//g, ".");
      const violators = Object.entries(importGraph).filter(([file, imps]) => {
        const hits = [...imps].some(
          (imp) => imp === forbidden || imp.startsWith(`${forbidden}.`),
        );
        const underForbidden = file.replace(/\\/g, "/").startsWith(
          forbidden.replace(/\./g, "/"),
        );
        return hits && !underForbidden;
      }).map(([file]) => file);
      const assessment = violators.length
        ? Assessment.LIKELY_DRIFTED
        : Assessment.STILL_HOLDS;
      const notes = violators.length
        ? `Violations in: ${violators.join(", ")}`
        : "No forbidden imports found in Python files.";
      out.push({
        decision_id: `rule:${forbidden}`,
        title: `Do not import ${forbidden}`,
        kind: "dependency_rule",
        summary: line.trim(),
        evidence: [{ path: rel, line: lineNum, excerpt: line.trim() }],
        assessment,
        notes,
      });
    }
  }
  return out;
}

export function scanNamingConvention(root) {
  const app = path.join(root, "app");
  const violations = [];
  if (fs.existsSync(app) && fs.statSync(app).isDirectory()) {
    for (const filePath of walkFiles(app, (p) => p.endsWith(".py"))) {
      const base = path.basename(filePath, ".py");
      if (base.includes("-") || base !== base.toLowerCase()) {
        violations.push(relPath(root, filePath));
      }
    }
  }
  const assessment = violations.length
    ? Assessment.LIKELY_DRIFTED
    : Assessment.STILL_HOLDS;
  return [
    {
      decision_id: "naming:python-modules",
      title: "Python modules use snake_case file names",
      kind: "naming_convention",
      summary:
        "Project convention: lowercase snake_case for .py file names under app/.",
      evidence: [{ path: "app/", line: null, excerpt: "scanned *.py filenames" }],
      assessment,
      notes: violations.length
        ? `Non-conforming files: ${violations.join(", ")}`
        : "All scanned module filenames match snake_case.",
    },
  ];
}

export function runScan(rootInput) {
  const root = path.resolve(rootInput);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }
  const importGraph = collectPythonImports(root);
  return [
    ...scanAdrs(root),
    ...scanCommentMarkers(root),
    ...scanModuleStructure(root),
    ...scanDependencyRules(root, importGraph),
    ...scanNamingConvention(root),
  ];
}

export function formatReport(root, decisions) {
  const lines = [
    "# Architectural decision report",
    "",
    `Root: \`${root}\``,
    `Decisions found: ${decisions.length}`,
    "",
  ];
  for (const d of decisions) {
    lines.push(`## [${d.kind}] ${d.title}`);
    lines.push(`- **ID:** ${d.decision_id}`);
    lines.push(`- **Assessment:** ${d.assessment}`);
    lines.push(`- **Summary:** ${d.summary}`);
    if (d.notes) lines.push(`- **Notes:** ${d.notes}`);
    lines.push("- **Evidence:**");
    for (const ev of d.evidence) {
      const loc = ev.line != null ? `${ev.path}:${ev.line}` : ev.path;
      lines.push(`  - \`${loc}\` — ${ev.excerpt}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
