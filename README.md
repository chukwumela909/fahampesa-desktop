# Fahampesa Desktop

Tauri 2 + React + TypeScript (Vite) desktop app for Fahampesa.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable, via rustup)
- Platform build tools:
  - **macOS**: Xcode Command Line Tools — `xcode-select --install`
  - **Windows**: Visual Studio Build Tools with the "Desktop development with C++" workload, plus WebView2 (preinstalled on Windows 11)

## Development

```sh
npm install
npm run tauri dev
```

## Building a release

```sh
npm install
npm run tauri build
```

Bundles are written to `src-tauri/target/release/bundle/`:

- **macOS**: `macos/Fahampesa.app` and `dmg/Fahampesa_<version>_<arch>.dmg`
- **Windows**: `msi/` and `nsis/` installers

### macOS notes

- The build targets the architecture of the machine building it (Apple Silicon → `aarch64`, Intel → `x64`). For a universal binary: `rustup target add x86_64-apple-darwin aarch64-apple-darwin`, then `npm run tauri build -- --target universal-apple-darwin`.
- The app is unsigned. It runs fine on the machine that built it, but if you share the `.dmg` with someone else, macOS Gatekeeper will block it ("app is damaged / from an unidentified developer"). The recipient can bypass with `xattr -cr /Applications/Fahampesa.app`, or the app must be signed and notarized with an Apple Developer account for clean distribution.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
