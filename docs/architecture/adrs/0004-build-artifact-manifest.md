# ADR 0004: Build Artifact Manifest

## Context

The build, package, publish, and update flows need a shared description of what a build produced.

Without that contract:

- `package` must rediscover files from the filesystem
- metadata can drift between commands
- later update/publish logic has no stable artifact boundary

## Decision

`bunlet build` writes a build artifact manifest into the output directory.

Initial scope:

- app name
- app version
- selected webview engine
- main bundle path
- preload bundle path when present
- renderer directory path
- generated package metadata path
- native runtime paths when copied

Current consumers:

- `package` validates and reads the build artifact manifest when present

## Consequences

Positive:

- build outputs become machine-readable
- `package` can validate build structure before packaging
- later publish/update work can reuse the same contract

Negative:

- manifest schema versioning will need to evolve as artifact types grow
- current manifest scope is still narrower than the final packaging/update model
