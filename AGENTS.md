# Job Fill

Chrome MV3 extension for autofilling job application forms from a local profile.

## Knowledge hub

When working under `E:\MyProjects\`, also consult:

- `E:\MyProjects\skill_repo\AGENTS.md`
- `E:\MyProjects\skill_repo\INDEX.md`

Capture reusable learnings back to the hub after substantive work (sanitize secrets).

## Local conventions

- Manifest V3 + Vite + TypeScript + `@crxjs/vite-plugin`
- Profile data stays in `chrome.storage.local` — no network calls for autofill
- Prefer extending `src/shared/synonyms.ts` over site-specific scrapers in v1
- Never auto-submit application forms
