# Runtime Capability Matrix

This matrix is the current architectural contract for backend-gated features in `packages/bunlet`.

| Capability | System WebView | CEF Scaffold |
| --- | --- | --- |
| `windowManagement` | yes | yes |
| `multiWindow` | yes | yes |
| `ipcInvoke` | yes | yes |
| `mainToRendererPush` | yes | yes |
| `executeJavaScript` | yes | no |
| `devtools` | yes | no |
| `navigation` | yes | no |
| `preloadScripts` | yes | no |
| `contextIsolation` | yes | no |
| `sessionPartitions` | yes | no |
| `cookies` | yes | no |

Notes:

- The system backend reflects the current `@bunlet/native` implementation.
- The CEF backend is scaffold-level for several core runtime APIs and is intentionally gated instead of silently degraded.
- Public APIs should check capabilities before calling backend-specific functionality.
