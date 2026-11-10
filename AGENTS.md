# Job Fill

Chrome MV3 extension for autofilling job application forms from a local profile.

## Knowledge hub

When working under `E:\MyProjects\`, also consult:

- `E:\MyProjects\skill_repo\AGENTS.md`
- `E:\MyProjects\skill_repo\INDEX.md`

Capture reusable learnings back to the hub after substantive work (sanitize secrets).

## Local conventions

- Manifest V3 + Vite + TypeScript + `@crxjs/vite-plugin`
- Vanilla TypeScript and plain CSS only (no React/Tailwind/component libraries)
- Profile data stays in `chrome.storage.local` — no network calls for autofill
- Prefer extending `src/shared/synonyms.ts` and `autocomplete.ts` over site scrapers
- Never auto-submit application forms; never overwrite non-empty fields
- Fill via `chrome.scripting.executeScript` + `globalThis.__jobFill` for all frames
- Set text values through the native prototype setter (React-friendly)
- Use `src/ui/dom.ts` `h()` instead of `innerHTML` templates for extension UI
- After substantive changes: `npm run check` must pass
