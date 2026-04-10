# ADR 0001: Runtime Engine Selection

## Context

Bunlet supports multiple runtime backends, starting with system webview and CEF.

The project previously allowed runtime backend selection to be inferred from source-level config files in the current working directory. That made backend choice dependent on process launch location and created drift between source configuration and built application behavior.

## Decision

Runtime engine selection should be explicit at bootstrap time.

Current transitional policy:

- development mode sets `BUNLET_WEBVIEW_ENGINE` explicitly
- build output writes the selected engine into bundled package metadata
- the public runtime no longer reads source `bunlet.config.json` directly

Target policy:

- runtime engine selection is supplied through a dedicated bootstrap/config contract
- backend capability reporting is exposed through the runtime layer

## Consequences

Positive:

- less coupling between source tree layout and runtime backend choice
- cleaner path toward backend parity testing
- easier packaging behavior for backend-specific runtimes

Negative:

- transitional code still reads bundled package metadata as a fallback
- build and runtime bootstrap must stay aligned until a stricter bootstrap contract lands
