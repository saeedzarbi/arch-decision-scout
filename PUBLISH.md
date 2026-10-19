# Publishing `arch-decision-scout` to npm

This document describes how to publish the package. **Do not commit npm tokens or run publish from untrusted CI without scoped secrets.**

## Prerequisites

- Node.js **18+**
- An [npm](https://www.npmjs.com/) account
- The package name `arch-decision-scout` available on npm (or change `name` in `package.json` to your scope, e.g. `@your-org/arch-decision-scout`)
- Replace `YOUR_ORG` in `package.json` `repository`, `homepage`, and `bugs` with your real GitHub org/user before publishing

## Local checks (before publish)

```bash
cd /path/to/arch-decision-scout

# Demo scan (expects 9 decisions + app.legacy drift)
npm run demo

# Prepublishes the same assertions as prepublishOnly
node scripts/prepublish-check.js

# Inspect tarball contents (does not upload)
npm pack --dry-run
npm pack
tar -tzf arch-decision-scout-0.1.0.tgz
```

## Publish steps

1. **Log in to npm** (interactive; use a granular access token with publish rights if you prefer):

   ```bash
   npm login
   ```

2. **Bump version** when releasing changes (semver):

   ```bash
   npm version patch   # or minor / major
   ```

3. **Publish** (public package; required for unscoped names):

   ```bash
   npm publish --access public
   ```

   For a scoped package:

   ```bash
   npm publish --access public
   ```

4. **Verify** from a clean directory (no local `npm link`):

   ```bash
   npx arch-decision-scout@0.1.0 /path/to/your/repo
   npx arch-decision-scout@0.1.0 /path/to/your/repo --json
   ```

   Or install globally:

   ```bash
   npm install -g arch-decision-scout
   arch-decision-scout /path/to/your/repo
   ```

## What gets published

The `files` field in `package.json` limits the package to `bin/` and `lib/`. npm also includes `package.json`, `README.md`, and `LICENSE`. `.npmignore` excludes `fixture/`, `scripts/`, and dev-only paths.

## Troubleshooting

- **`403 Forbidden` on publish** — wrong account, 2FA required, or name already taken.
- **`prepublishOnly` failed** — run `npm run demo` locally; fixture must report 9 decisions and `rule:app.legacy` as `likely_drifted`.
- **`npx` runs old version** — clear npm cache or pin `@version` explicitly.
