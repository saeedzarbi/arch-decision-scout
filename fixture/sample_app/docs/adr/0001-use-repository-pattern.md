# Use repository pattern for persistence

## Status

Accepted

## Context

We chose to keep SQL and ORM details out of API handlers so we can swap storage later.

## Decision

All database access goes through `app.domain` repositories. API layer calls repositories only.

## Consequences

- Handlers stay thin
- Tests can mock repositories
