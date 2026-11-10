# Job Fill

Chrome extension (Manifest V3) that autofills job application forms from a **local** profile. It combines:

1. **Heuristic matching** on labels, names, placeholders, and autocomplete attributes
2. **Manual form mappings** you teach once per site, reused on later visits

No cloud sync, no resume upload, and it never clicks Submit/Apply.

## Load unpacked (dev)

```bash
npm install
npm run dev
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder created by Vite/CRXJS

For a production build:

```bash
npm run build
```

Then load `dist/` the same way.

## Usage

1. Open the extension **Options** page and fill your basic profile (name, email, phone, address, LinkedIn, portfolio, work auth, salary).
2. On a job application page, open the popup and click **Fill this page** (or press `Alt+Shift+F`).
3. For fields the heuristic misses, click **Map this form**, click each stubborn input, choose the profile field, then **Save mapping**.
4. Next visit to the same origin/path pattern fills mapped fields first, then heuristics for the rest.

## Privacy

- Profile and mappings live in `chrome.storage.local` only.
- Do not store SSNs or government IDs in free-text fields.
- Export/import JSON is available on the Options page for backups.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Build + HMR via CRXJS |
| `npm run build` | Typecheck + production build |
| `npm test` | Vitest unit tests (matcher + path patterns) |

## Project layout

```
src/
  background/     service worker (storage message router + keyboard command)
  content/        fill engine, synonym matcher, map-mode UI
  popup/          Fill / Map / Open profile
  options/        profile editor, settings, mapping management
  shared/         types, storage helpers, synonyms, path matching
```
