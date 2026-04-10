# 0007 Docs Source Of Truth

## Context

The repo contained both `docs/` and `documentation/`, but the maintained content now lives in `docs/` while `documentation/` had already drifted into stale MkDocs scaffolding.

## Decision

Use `docs/` as the single source of truth for repository documentation and mark `documentation/` as deprecated until it is removed.

## Consequences

Architecture and API changes only need to update one tree, and contributor guidance can point to one canonical location instead of carrying duplicate maintenance overhead.
