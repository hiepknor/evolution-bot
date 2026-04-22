# Evo Broadcast Control

Production-ready cross-platform desktop operations console for broadcasting image + caption messages to many WhatsApp groups through Evolution API.

## Stack

- Tauri v2
- React + TypeScript + Vite
- Tailwind CSS + shadcn-style UI primitives
- Zustand
- TanStack Query
- React Hook Form + Zod
- SQLite via `@tauri-apps/plugin-sql`
- dayjs + uuid

## Features

- Connection settings with local persistence (`app_settings`)
- Evolution API provider + mock provider mode
- Group sync and cache (`groups_cache`)
- Search/select/invert selection for targets
- Message composition:
  - image picker
  - intro/title/footer
  - caption template placeholders: `{group_name}`, `{index}`, `{members}`, `{date}`
  - plain text fallback
- Broadcast queue:
  - dry run / real send
  - sequential processing
  - random delay jitter
  - retry attempts
  - emergency stop
- Safety controls:
  - confirmation modal before send
  - large-audience warning banner
  - duplicate checksum warning
  - blacklist/whitelist mode
- Real-time logs + persisted logs (`campaign_logs`)
- Campaign history and reopen
- CSV export for latest campaign
- Recovery handling for interrupted runs (`running` campaigns become `failed` on startup)

## Local DB Schema

Created automatically on startup:

- `app_settings`
- `groups_cache`
- `campaigns`
- `campaign_targets`
- `campaign_logs`

Migration file: `src/lib/db/schema.ts`

## Prerequisites

Install on your machine:

1. Node.js 20+
2. Rust toolchain (`rustup`, `cargo`)
3. Tauri system dependencies for your OS:
   - macOS: Xcode Command Line Tools
   - Windows: WebView2 + MSVC build tools
   - Linux: webkit2gtk, libgtk-3, and required build packages

## Run

```bash
npm install
npm run tauri:dev
```

Alternative scripts:

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run check
npm run release:prep
npm run tauri:build
```

## Configure Evolution API

1. Open **Connection** panel.
2. Set:
   - Base URL (for example `http://localhost:8080`)
   - API key
   - Instance name
   - Provider: `evolution` or `mock`
3. Click **Save Settings**.
4. Click **Test Connection**.
5. Sync groups from the **Groups** panel.

## Mock Mode

Switch provider to `mock` in Connection panel.

Mock mode provides:

- simulated successful connection
- synthetic group list
- simulated sends with random failure rates
- realistic queue/log behavior for demos

## Build Desktop Binaries

```bash
npm run tauri:build
```

Artifacts will be in `src-tauri/target/release/bundle`.

Platform-specific shortcuts:

```bash
# macOS app + dmg (on macOS host)
npm run package:mac

# Windows installer (on Windows host)
npm run package:windows

# Windows installer cross-build from macOS
npm run package:windows:mac-cross
```

Cross-build prerequisites (macOS -> Windows):

- `rustup target add x86_64-pc-windows-msvc`
- `cargo install cargo-xwin`
- `brew install llvm lld nsis`

## Release Procedure

- Full finalization SOP: `docs/APP_FINALIZATION_PLAYBOOK.md`
- UAT acceptance list: `docs/UAT_ACCEPTANCE_CHECKLIST.md`
- GitHub publish checklist: `docs/GITHUB_PUBLISH_CHECKLIST.md`

## Safety Notes for Bulk Sends

- Always run **Dry Run** first.
- Validate selected group count and warning threshold.
- Review duplicate-content warning before running real send.
- Use blacklist/whitelist to constrain target scope.
- Keep random delays enabled to reduce spam patterns.
- Use **Emergency Stop** to halt future queue items immediately.

## Known Limitations

- Evolution API deployments can differ in endpoint shape; `EvolutionProvider` includes fallback group endpoints but may require path adjustments.
- Image media upload uses base64 payload; some Evolution setups may require external media URLs depending on server configuration.
- Pane resizing is not implemented yet (layout is responsive and desktop-focused).

## Secret Storage

- Desktop secret values (API key) are stored via OS keychain using Tauri `keyring` integration in [src-tauri/src/lib.rs](src-tauri/src/lib.rs).
- Local DB keeps app settings metadata, but the sensitive key material is retrieved from keychain at runtime.

## Important Paths

- App entry: `src/main.tsx`
- Main UI: `src/pages/dashboard-page.tsx`
- Provider interface: `src/lib/providers/messaging-provider.ts`
- Evolution provider: `src/lib/providers/evolution-provider.ts`
- Queue engine: `src/lib/queue/broadcast-queue.ts`
- DB repositories: `src/lib/db/repositories.ts`
- Tauri config: `src-tauri/tauri.conf.json`

## License

MIT (`LICENSE`)
