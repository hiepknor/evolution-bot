# GitHub Publish Checklist

## 1) Code Quality Gate

Run and ensure all pass:

```bash
npm run check
```

## 2) Desktop Build Gate

macOS bundle:

```bash
npm run package:mac
```

macOS DMG:

```bash
npm run tauri:build -- --ci --bundles dmg
```

Windows setup from macOS (cross-build):

```bash
npm run package:windows:mac-cross
```

## 3) Security Gate

Production dependency audit:

```bash
npm audit --omit=dev --audit-level=high
```

## 4) Git Hygiene

- Verify ignored build outputs are not tracked (`dist`, `node_modules`, `src-tauri/target`).
- Keep `package-lock.json` tracked so CI `npm ci` is deterministic.
- Ensure no real credentials are committed (`.env` is ignored; only `.env.example` is tracked).

## 5) CI / Release Workflows

- PR + branch validation: `.github/workflows/ci.yml`
- Desktop installers on tag/manual: `.github/workflows/build-desktop.yml`

## 6) Publish Commands

```bash
git add .
git commit -m "chore: prepare github publish"
git remote add origin <your-repo-url>
git push -u origin main
```

## 7) Optional Distribution Hardening

- Sign and notarize macOS app/DMG.
- Sign Windows installer (`nsis` / `msi`) on Windows host with code-signing cert.
