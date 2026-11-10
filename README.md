# Job Fill

Chrome extension (Manifest V3) that autofills job application forms from a **local** profile.

## Features

- Heuristic matching on labels, names, placeholders, autocomplete, and `type`
- Manual form mappings (per origin + path pattern), preferred over heuristics
- Custom answers for mapped free-text questions only
- Multi-frame fill via `all_frames` + `chrome.scripting.executeScript`
- Undo last fill, fill report in the popup
- Autofill-on-load only for origins you enable
- Import/export JSON backups with validation

Never clicks Apply/Submit. No network calls for autofill.

TypeScript is pinned to `~5.8.0` because `typescript-eslint` currently peers on TypeScript below 6.1; Vite accepts newer TypeScript, but the lint toolchain does not yet.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Profile, mappings, settings in `chrome.storage.local` |
| `scripting` | Call the content API in every frame (`fillTab` / `undoTab` / map mode) |
| Host `http(s)://*/*` | Run content scripts (and reach cross-origin application iframes) |

## Load unpacked

```bash
npm install
npm run dev
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `dist/`

Production build:

```bash
npm run build
```

## Usage

1. Open **Options** and complete your profile (autosaves).
2. On an application page, **Fill this page** (or `Alt+Shift+F`).
3. Use **Map this form** for stubborn fields; optionally add custom answers and map them.
4. Toggle **Autofill on this site** after a mapping exists.

## Licence

MIT — see [LICENSE](LICENSE).

## Privacy

https://megokul.github.io/job-fill/privacy.html

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | CRXJS/Vite HMR build into `dist/` |
| `npm run build` | Typecheck + production build |
| `npm run package` | Production build + zip under `release/` |
| `npm test` | Vitest |
| `npm run lint` | ESLint |
| `npm run check` | `tsc` + ESLint + tests |
| `npm run e2e` | Build e2e extension + Playwright suite |
| `npm run check:all` | `check` then `e2e` |

## Scope

- English-language forms only.
- State and province lists cover the United States and Canada.
- Resume upload and other file fields are never touched.

## Known limits

- Undo restores typed text on scripted dropdowns (comboboxes) best-effort; it may not clear a widget’s internal selection if the control keeps state outside the DOM value.

## Privacy

- Data stays in `chrome.storage.local`
- Do not store SSNs or government IDs
- Export/import is local JSON only
