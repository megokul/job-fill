# Manual ATS smoke checklist

From `docs/CURSOR_PLAN.md`. Unpacked build: `dist/` after `npm run build`.

## Automated coverage (this session)

`npm run e2e` — all fixture cases green (plain, react, embedded iframe, late autofill, distractors, hidden, combobox, map mode, network, submit trap, wizard, scrolled). That covers every checklist row against controlled fixtures.

## Live ATS (owner Chrome)

Load unpacked `dist/`, fill Options profile, then on at least three real application pages (one iframe-hosted, one React-based):

| Check | Live result |
| --- | --- |
| Fill name, email, phone, location, LinkedIn; values survive blur | _owner_ |
| Free-text questions stay empty | _owner_ |
| Pre-typed fields untouched | _owner_ |
| Country/state never wrong option | _owner_ |
| Yes/no radios correct; already-answered untouched | _owner_ |
| Undo restores filled fields | _owner_ |
| Map mode bind two fields, save, reload, fill | _owner_ |
| No submit; Network shows no extension requests | _owner_ |
| Autofill-on-load only on enabled sites | _owner_ |

Live boards browsed this session (no Fill — Cursor browser cannot load the unpacked MV3 extension): Stripe careers search (`https://stripe.com/careers/search`). Use any open role’s Apply form in your own Chrome with `dist/` loaded.
