# Arch Decision Scout

A minimal proof-of-concept **Node.js CLI** for an AI-agent-oriented workflow: surface **architectural decisions** in an existing codebase—not only current formatting, but **recorded intent** (ADRs, decision comments, layering rules) and whether the implementation still matches or has **drifted**.

## Problem

Teams lose track of architectural decisions over time:

- **ADRs** in `docs/` go unread while code changes.
- **Implicit rules** live in comments (`# DECISION: …`) and vanish during refactors.
- **Layer boundaries** (e.g. “do not import legacy”) are violated quietly.
- **Coding agents** without this history suggest patterns that conflict with past choices.

## What it does

Scans a target directory and reports:

| Signal | What we look for |
|--------|------------------|
| **ADRs** | `docs/adr/*.md` and similar layouts |
| **Explicit markers** | `ARCHITECTURE:`, `DECISION:`, `ADR:` in comments |
| **Keywords** | `why`, `decided`, `chosen`, `tradeoff`, `deprecated` in comment lines |
| **Module structure** | Python packages under `app/` (`__init__.py`) |
| **Dependency rules** | Forbidden imports in `ARCHITECTURE.md` vs Python `import` / `from` |
| **Naming** | snake_case filenames for `app/**/*.py` |

Each item includes **evidence** (file + line when available) and an assessment: `still_holds`, `uncertain`, or `likely_drifted`.

**Zero runtime dependencies** — Node.js 18+ and the standard library only.

## Quickstart

```bash
# From this repository root (no npm install required)
node bin/arch-decision-scout.js fixture/sample_app
```

Or use the npm script:

```bash
npm run demo
```

JSON output:

```bash
node bin/arch-decision-scout.js fixture/sample_app --json
```

After `npm link` (or `npm install -g` from this folder):

```bash
arch-decision-scout /path/to/your/repo
```

### Demo fixture

`fixture/sample_app/` includes:

- An **Accepted** ADR (repository pattern)
- **ARCHITECTURE.md** — do not import `app.legacy`
- **Intentional drift** — `app/api/handlers.py` imports `app.legacy` → `likely_drifted`
- Decision / tradeoff / deprecated comments for marker detection

## Project structure

```
arch-decision-scout/
├── package.json
├── bin/
│   └── arch-decision-scout.js    # CLI entry (bin)
├── lib/
│   ├── scan.js                   # Scanners and report formatting
│   └── cli.js                    # Argument parsing
├── fixture/
│   └── sample_app/               # Demo tree
├── LICENSE                       # MIT
└── README.md
```

## License

MIT — see [LICENSE](LICENSE).
