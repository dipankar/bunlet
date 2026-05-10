# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial public release pipeline with automated CI/CD for macOS, Linux, and Windows.
- OIDC-based provenance attestation for npm packages.
- crates.io publishing for `bunlet-native` and `bunlet-cef-native`.
- Package-level READMEs with SEO optimization for all published crates and packages.
- GitHub artifact attestation for all release binaries.

## [0.1.0] - 2026-05-10

### Added

- Core desktop framework with Bun and WebView.
- Cross-platform native window management via Tao.
- WebView rendering via WRY (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux).
- Type-safe IPC with Zod validation.
- Native OS APIs: file dialogs, menus, system tray, notifications, clipboard, global shortcuts, file watcher, power monitor.
- `@bunlet/cli` with `create`, `dev`, `build`, and `package` commands.
- CEF (Chromium Embedded Framework) backend as an optional alternative WebView engine.
- 7 example applications demonstrating real-world usage.
