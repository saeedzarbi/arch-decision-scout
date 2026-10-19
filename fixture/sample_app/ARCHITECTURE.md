# Architecture notes

## Layers

- `app.api` — HTTP entrypoints
- `app.domain` — business logic and repositories
- `app.legacy` — old code kept for reference only

## Rules

- API must not import from `app.legacy` (use domain services instead).
- Do not import from app.legacy in new modules.
