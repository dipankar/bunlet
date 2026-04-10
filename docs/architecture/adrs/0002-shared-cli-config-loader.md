# ADR 0002: Shared CLI Config Loader

## Context

The CLI had multiple separate `loadConfig` implementations across `dev`, `build`, `package`, and `publish`.

That duplication creates drift in:

- config file resolution order
- supported config file extensions
- error handling
- future normalization work

## Decision

All CLI commands should load project configuration and package metadata through a shared config module.

Initial implementation:

- shared loader in `packages/bunlet-cli/src/config/index.ts`
- all main CLI commands use that module
- config tests are added at the shared module boundary

## Consequences

Positive:

- one place to evolve config normalization
- lower risk of command-specific behavior drift
- cleaner foundation for later artifact-manifest and build-pipeline work

Negative:

- later schema validation is still needed
- command defaults are not fully centralized yet
