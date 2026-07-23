# Meter Split Calculator

Installable PWA that splits a shared electricity recharge between a main meter
and a sub meter based on reading diffs, with a printable receipt and saved
calculation history.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview   # test the production build locally
```

## Deploy to GitHub Pages (installs on Android)

1. Create a new GitHub repo and push this folder to it.
2. In the repo: **Settings -> Pages -> Source -> GitHub Actions**.
3. Push to `main` -- the included workflow (`.github/workflows/deploy.yml`)
   builds and deploys automatically. Your app will be live at
   `https://<username>.github.io/<repo-name>/`.
4. On Android, open that URL in Chrome -> menu (three dots) -> **Add to Home screen** /
   **Install app**. It opens full-screen with no browser bar, works offline,
   and updates automatically when you push changes.

No app store, no signing, no Play Console account needed.

## Features

- Main/sub meter split calculation with demand charge sharing
- Printable 80mm receipt (Download PDF button, opens browser print dialog)
- Inputs auto-save locally, so reopening the app keeps your last numbers
- Save/History panel to keep a record of past calculations and reload any of them
