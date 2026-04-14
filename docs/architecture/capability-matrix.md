# Runtime Capability Matrix

This matrix is the current architectural contract for backend-gated features in `packages/bunlet`.

| Capability | System WebView | CEF Backend |
| --- | --- | --- |
| `windowManagement` | yes | yes |
| `multiWindow` | yes | yes |
| `ipcInvoke` | yes | yes |
| `mainToRendererPush` | yes | yes |
| `executeJavaScript` | fire-and-forget | yes (returns result) |
| `devtools` | yes | yes |
| `navigation` | yes | yes |
| `preloadScripts` | yes | yes |
| `contextIsolation` | yes | yes |
| `sessionPartitions` | yes | yes |
| `cookies` | limited (no read) | yes |
| `authoritativeGetURL` | no (uses tracking) | yes |
| `authoritativeCanGoBack` | no (uses tracking) | yes |

Notes:

- The system backend reflects the current `@bunlet/native` implementation using tao + wry.
- The CEF backend is now a full Chromium Embedded Framework integration (via `cef` crate from tauri-apps/cef-rs), providing complete web compatibility including DevTools, `executeJavaScript`, navigation, preload scripts, and context isolation.
- `executeJavaScript` on the system webview backend is fire-and-forget — it cannot return values. Use IPC channels for round-trip communication.
- `cookies` on the system webview backend cannot be read (`getCookies` always returns `[]`). CEF provides full cookie access via `RequestContext`.
- `sessionPartitions` and `cookies` are now fully implemented for CEF via `RequestContext` and `CookieManager`. The CEF backend provides full cookie read/write/delete access and storage data clearing through CEF's native APIs.
- Ghost stubs (methods that silently do nothing) have been replaced with explicit errors that throw at runtime.
- Public APIs should check capabilities before calling backend-specific functionality.
- Mixed-back-end mode (via `BUNLET_CEF_ENABLE_NATIVE_FALLBACK=1`) allows platform APIs (dialog, tray, etc.) that are not yet implemented in `@bunlet/cef-native` to fall back to `@bunlet/native`. This should not be used long-term.

## System WebView Known Limitations

The system webview (wry) backend has the following architectural limitations:

| API | Limitation |
| --- | --- |
| `executeJavaScript` | Fire-and-forget only; cannot return values. Use IPC for round-trips. |
| `getURL()` / `getTitle()` | Uses WebContentsState tracking, not native queries. |
| `canGoBack()` / `canGoForward()` | Uses WebContentsState tracking, not native queries. |
| `getCookies()` | Always returns `[]`; wry cannot read `document.cookie` results. |
| `getUserAgent()` | Cannot return values from `evaluate_script`; throws explicit error. |
| `setUserAgent()` | Must be set during window creation, not after. |
| `flushStore()` | Not supported; throws explicit error. |
| `isSpellCheckerEnabled()` / `setSpellCheckerEnabled()` | Not implemented; throws explicit error. |
| `showMessageBox` | Limited to 2 buttons (rfd limitation); warns on 3+ |

## Window Events

All standard window events are now dispatched from the native layer:

| Event | Source |
| --- | --- |
| `focus` / `blur` | tao `WindowEvent::Focused` |
| `resize` / `move` | tao `WindowEvent::Resized` / `WindowEvent::Moved` |
| `close` / `closed` / `destroyed` | tao `WindowEvent::CloseRequested` / `WindowEvent::Destroyed` |
| `scale-factor-changed` | tao `WindowEvent::ScaleFactorChanged` |
| `theme-changed` | tao `WindowEvent::ThemeChanged` |
| `file-drop` / `file-drag-enter` / `file-drag-leave` | tao `WindowEvent::DroppedFile` / `HoveredFile` / `HoveredFileCancelled` |
| `page-title-updated` | JS MutationObserver |
| `did-navigate` / `did-start-loading` / `did-finish-load` | JS navigation interception |
| `preload-success` / `preload-error` | Preload script lifecycle |

## Preload Lifecycle

Preload scripts are now wrapped in a try/catch with explicit lifecycle events:

- On success: emits `preload-success` with the script path
- On failure: emits `preload-error` with the script path, error message, and stack trace
- Context isolation: `contextBridge.exposeInMainWorld()` deep-clones objects and wraps functions to prevent prototype pollution
