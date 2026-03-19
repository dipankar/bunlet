# System WebView

System WebView is Bunlet's default backend (`webview.engine = "system"`).

## Engines by Platform

- Windows: WebView2
- macOS: WKWebView
- Linux: WebKitGTK

## Why Use It

- Smaller bundle size
- Uses OS-provided runtime
- Fast startup for lightweight apps

## Known Tradeoffs

- Rendering behavior can vary between platforms.
- Linux requires a working desktop/GTK/WebKit environment.
