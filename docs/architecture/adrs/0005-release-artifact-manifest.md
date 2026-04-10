# ADR 0005: Release Artifact Manifest

## Context

After packaging, the repo still relied on rescanning the `release/` directory to decide what should be published.

That keeps package and publish loosely coupled and makes release metadata dependent on filename conventions instead of an explicit contract.

## Decision

`bunlet package` writes a release artifact manifest into the release directory.

Initial scope:

- app name
- app version
- packaged artifact list
- artifact platform
- artifact format
- artifact path relative to the release directory
- whether the artifact is a file or directory

Current consumers:

- `publish` validates and prefers the release artifact manifest when present

## Consequences

Positive:

- package and publish now share a release contract
- publish no longer depends entirely on directory rescanning
- later signing, hashes, and release metadata can be added to one place

Negative:

- current publish flow still falls back to scanning for backward compatibility
- manifest schema will need to evolve as more package types are added
