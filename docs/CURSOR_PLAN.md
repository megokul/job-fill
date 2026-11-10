# Job Fill — improvement and UI plan (for Cursor)

This file is the brief for an AI coding agent. Work through the phases in order. Each phase is one reviewable change.

## Ground rules

- Read `AGENTS.md` first. Its conventions are binding: MV3 + Vite + TypeScript + `@crxjs/vite-plugin`, profile data only in `chrome.storage.local`, no network calls, **never submit or click Apply/Submit**.
- Stay in vanilla TypeScript and plain CSS. Do not add React, Tailwind, or a component library. The only new dev dependency allowed without asking is `happy-dom` (Phase 0) and ESLint (Phase 6).
- Never overwrite a field the user has already filled.
- After every phase: `npm run build` and `npm test` must pass. Do not start the next phase with a red build.
- Write the failing test first for every bug listed in Phase 1.
- Where this plan says "verify against the docs", check the current Chrome extension or CRXJS documentation before coding; do not rely on memory.
- If a task turns out to be wrong or impossible as written, stop and say so rather than improvising a different design.

## Current state (verified 2026-11-10)

- Typecheck, 10 unit tests and the production build pass.
- Not a git repository. No lint, no CI, no DOM-level tests.
- `src/content/__tests__/` is an empty folder.
- The background message router (`src/background/index.ts`, most of `src/shared/messages.ts`) is unused: popup, options and content script call `src/shared/storage.ts` directly.

### Confirmed defects (reproduced with `scoreField`)

| Input | Current result | Expected |
| --- | --- | --- |
| label "How did you hear about this opportunity?" | `addressLine2`, score 82 | no match |
| label "Ethnicity" | `city`, 82 | no match |
| label "Personal statement" | `state`, 83 | no match |
| label "Tell us about yourself" | `phone`, 81 | no match |
| label "Hotel preference" | `phone`, 81 | no match |
| label "Reference last name" | `lastName`, 87 | no match |
| label "Full name" | no match | `fullName` (derived) |
| autocomplete `address-level2` | `addressLine1`, 77 | `city` |
| autocomplete `address-level1` | `addressLine1`, 77 | `state` |
| autocomplete `url` | no match | `portfolioUrl` |
| `selectOption` yes/no regex, `filler.ts:183` | tests `value + ' ' + text`, can never match | matches Yes/No options |

### Suspected defects (from reading the code, not yet reproduced — reproduce in a test first)

- `selectOption` substring fallback picks the first option containing the text: country "US" selects "Australia"; state "CA" selects "American Samoa".
- `el.value = x` plus an `input` event (`filler.ts:161`) is ignored by React-controlled inputs; the value reverts on the next render.
- Radio buttons are scored one by one using the option label ("Yes"), never the group question. `isEmptyControl` checks one radio, so a group where the user chose "No" can still get "Yes" checked.
- The content script runs only in the top frame, so embedded application iframes are never reached.
- Autofill-on-load runs once at `document_idle` and misses forms rendered later; when enabled it fills matching forms on any site, not only job sites.
- Import accepts unvalidated JSON, and mapping ids are written unescaped into attributes (`options/main.ts:183`, `mapper-ui.ts:131`).

---

## Phase 0 — Safety net

1. `git init`, first commit of the current tree (check `.gitignore` covers `dist` and `node_modules`; it does today).
2. Add `happy-dom`. In `vitest.config.ts` keep `environment: 'node'` as default and use the `// @vitest-environment happy-dom` docblock in DOM tests.
3. Delete the empty `src/content/__tests__/`. Keep tests colocated as `*.test.ts`.
4. Add HTML fixtures under `src/content/fixtures/` as exported strings. Write them by hand to model common layouts (do not copy markup from real sites):
   - `labelFor.ts` — `<label for>` + inputs, with `autocomplete` attributes.
   - `wrappedLabel.ts` — inputs wrapped in labels, single "Full name" field, "Location (City)".
   - `radioGroups.ts` — `fieldset`/`legend` yes/no questions, plus a div-based group using `role="radiogroup"` and `aria-labelledby`.
   - `selects.ts` — country and state selects with numeric option values and full-name option text; a yes/no select with a "Select…" placeholder.
   - `distractors.ts` — the false-positive labels from the table above, plus reference and emergency-contact sections.
5. Add `src/content/filler.test.ts` with a helper `mount(html)` that sets `document.body.innerHTML`. Note: `isVisible` uses `getBoundingClientRect`, which returns zeros in happy-dom. Make visibility checking injectable (for example an optional `isVisible` parameter on `collectFillableElements`) rather than weakening it.

**Done when:** the new tests exist, the ones describing known bugs are marked `it.fails` or `it.todo`, and the suite is green.

## Phase 1 — Fill correctness

Files: `src/content/matcher.ts`, `src/content/filler.ts`, `src/shared/synonyms.ts`, `src/shared/types.ts`, new `src/shared/autocomplete.ts`, new `src/shared/regions.ts`.

1. **Token-boundary matching.** In `scoreField`, replace `hay.includes(needle)` with a whole-token phrase match on normalized text (needle tokens must appear as consecutive whole tokens in the haystack). Keep exact-match and token-overlap tiers. Exception: for `name` and `id` signals, first split camelCase and digits (`firstName` → `first name`, `address2` → `address 2`) so existing synonyms like `firstname`/`address2` still work.
2. **Negative context.** Add `NEGATIVE_CONTEXT` tokens to `synonyms.ts`: `reference`, `referee`, `emergency`, `company`, `employer`, `manager`, `recruiter`, `school`, `university`, `spouse`. If any appears in the label/aria-label, score 0 for all personal keys. Read the nearest `fieldset > legend` or section heading into a new `group` signal and apply the same rule to it.
3. **Autocomplete map.** New `autocomplete.ts`: map standard tokens directly to keys with score 200, bypassing synonyms: `given-name`, `family-name`, `name` → fullName, `email`, `tel`, `tel-national`, `address-line1`, `address-line2`, `address-level2` → city, `address-level1` → state, `postal-code`, `country`, `country-name`, `url` → portfolioUrl, `organization` → currentCompany (Phase 4; ignore until then). Ignore `off`, `on`, and section/`shipping`/`billing` prefixes. Also use `type="email"` and `type="tel"` as a +30 boost for the matching key.
4. **Derived values.** Introduce `FillKey = ProfileKey | 'fullName' | 'location'` and a `resolveValue(profile, key)` function: `fullName` = first + last; `location` = "City, State" (omit empty parts). Add synonyms: fullName — `full name`, `your name`, `legal name`, `name` (exact match only for bare `name`); location — `location`, `current location`, `city state`. Remove the now-unneeded "bare name" penalty.
5. **Native value setter.** In `setControlValue`, set text values through the prototype setter (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`, likewise for `HTMLTextAreaElement`), then dispatch `input` and `change` (bubbling), then `blur`. Do not call `el.focus()` (it scrolls the page); dispatch a `focus` event instead if needed. Same approach for `checked` on checkboxes/radios (use `el.click()` only if the control is unchecked, since React listens to click for these).
6. **Radio groups as one field.** In `collectFillableElements`, return one representative per radio group (same `name` within the same form, or members of one `role="radiogroup"`). Its signals use the group question: `legend`, `aria-labelledby` on the group, or the nearest preceding heading/label text. `isEmptyControl` for a radio is "no radio in the group is checked". `selectRadio` matches options by value/label within the group.
7. **Selects.** Fix the yes/no branch to test value and text separately. Replace the substring fallback with: exact match on value or text → alias match → whole-token prefix match (option text starts with the value as whole tokens) → no fill. New `regions.ts` holds US state and Canadian province code↔name pairs and a small country alias table (`US`, `USA`, `United States`, `United States of America`; `UK`, `United Kingdom`, `Great Britain`; plus ISO-2 codes for ~40 common countries). Use aliases only for `state` and `country`.
8. **Checkboxes.** Only fill a checkbox for `workAuthorized` / `requiresSponsorship`. Never fill a checkbox from any other key.
9. **`resolveMappedElement`.** Return the selector hit only if it is in the fillable list; otherwise fall through to signal similarity. Remove the redundant second `if (found)`.
10. Remove the dead branch in `toBoolean`.

**Done when:** every row in the defects table has a passing test with the expected result; the suspected-defect tests pass; a React-style test passes (attach an `input` listener that reads `el.value` and assert it sees the new value via the native setter path).

## Phase 2 — Fill report and undo (engine side of the new UI)

Files: `src/shared/messages.ts`, `src/content/filler.ts`, `src/content/index.ts`.

1. Extend `FillResult`:
   ```ts
   type FilledField = { label: string; key: FillKey; source: 'mapping' | 'heuristic' | 'custom' }
   type FillResult = {
     filled: FilledField[]
     skippedNonEmpty: number
     unmatched: { label: string }[]   // visible, empty, fillable, no match; cap at 20
     frameUrl: string
   }
   ```
   `label` is the best human-readable signal (label → aria-label → placeholder → name).
2. Keep an in-memory undo snapshot per frame: for each filled element, its previous value/checked state. Add `UNDO_FILL`, which restores through the same native-setter path and clears the snapshot. A new fill replaces the snapshot.
3. Delete the unused storage message types (`GET_STORE`, `SAVE_*`, `DELETE_*`, `GET_MAPPINGS_FOR_URL`) and the matching background handlers. Keep `FILL_PAGE`, `UNDO_FILL`, `START_MAP_MODE`, `STOP_MAP_MODE`, `PING`. Delete `MessageResponseMap` unless it is made to type the send helpers.

**Done when:** tests cover fill → undo round trip for text, select, checkbox and radio group.

## Phase 3 — Frames, late forms, privacy

Files: `manifest.config.ts`, `src/content/index.ts`, `src/background/index.ts`, `src/popup/main.ts`, `src/shared/types.ts`, `src/shared/storage.ts`.

1. **All frames.** Set `all_frames: true` and `match_about_blank: true` on the content script. Keep `host_permissions` as they are: `activeTab` alone does not cover cross-origin iframes, which is where embedded application forms live (verify against the docs before changing permissions in either direction).
2. **Per-frame calls.** `chrome.tabs.sendMessage` returns only one frame's response. The content script should expose its API on `globalThis.__jobFill` (`fill`, `undo`, `countFillable`, `startMap`, `stopMap`). Popup and the keyboard command call it with `chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func })`, which returns one result per frame (verify that promise results are awaited). Add `src/shared/tabApi.ts` with `fillTab(tabId)`, `undoTab(tabId)`, `startMapInBestFrame(tabId)` (frame with the most fillable elements). Aggregate `FillResult[]` for display. This is what the `scripting` permission is for; if this approach is abandoned, remove the permission.
3. **Shadow DOM.** `collectFillableElements` should recurse into open shadow roots.
4. **Late-rendered forms.** For autofill-on-load only: if nothing fillable matched, watch with a `MutationObserver` (debounced 400 ms) for up to 15 s, fill once when fields appear, then disconnect. Never refill after the user has typed in the page.
5. **Scope autofill-on-load.** Replace the global `autofillOnLoad` boolean with `autofillSites: string[]` (origins). Autofill on load runs only when the frame's origin is listed. Migrate in `getStore`: old `autofillOnLoad: true` → origins of all saved mappings; then drop the old key. The content script must exit early, without building the profile object, on pages that are not listed.
6. **Shadow-root UI host.** New `src/content/ui/host.ts`: one `<job-fill-root>` element with a closed shadow root holding toast, map banner and map panel, with styles in a `<style>` inside the root. Stop writing `outline` onto page elements: draw hover/selected/filled highlights as absolutely positioned boxes inside the shadow root, repositioned on scroll/resize.
7. **Import validation.** New `src/shared/validate.ts` with `parseBackup(json): { store, errors }`: profile values must be strings (truncate at 500 chars), unknown keys dropped, yes/no keys coerced, mapping ids regenerated with `crypto.randomUUID()` if not UUID-shaped, `profileKey` must be a known key, `origin` must parse as an http(s) origin. Escape every interpolated value in `innerHTML` templates, or build those nodes with `createElement`/`textContent`.
8. Fix the read-modify-write race in `saveFormMapping`/`delete*` by serializing writes through a module-level promise chain.

**Done when:** a fixture page with a same-origin iframe fills in the iframe test (unit level: `collectFillableElements(iframe.contentDocument)`); migration and `parseBackup` have tests; no `style.outline` writes to page elements remain.

## Phase 4 — Profile coverage and custom answers

1. Add profile keys: `preferredName`, `pronouns`, `githubUrl` (stop routing "github" to `portfolioUrl`), `currentCompany`, `currentTitle`, `yearsExperience`, `noticePeriod`, `howDidYouHear`. Add labels, synonyms, and `EMPTY_PROFILE` entries. `currentCompany`/`currentTitle` are exempt from the `company`/`employer` negative-context rule only when the label says `current` or `present`.
2. **Custom answers.** New store key `customAnswers: { id, question, answer, updatedAt }[]`. A `FieldMapping` may target either a profile key or `{ customAnswerId }`. Custom answers are filled **only** through saved mappings, never heuristically.
3. Bump a `schemaVersion` in the store and migrate in `getStore`.

## Phase 5 — UI

Shared foundation first: `src/ui/tokens.css` (imported by popup and options, and inlined into the content shadow root) and `src/ui/dom.ts` (a tiny `h(tag, props, ...children)` helper so no template strings are fed to `innerHTML`).

### Design tokens

- Accent teal `#0f766e` (hover `#0d9488`), ink `#0f172a`, muted `#64748b`, line `#e2e8f0`, surface `#ffffff`, page `#f8fafc`. Status: ok `#166534` on `#dcfce7`, warn `#9a3412` on `#ffedd5`, danger `#b91c1c` on `#fee2e2`.
- Dark theme via `prefers-color-scheme`: page `#0b1220`, surface `#111a2e`, ink `#e2e8f0`, muted `#94a3b8`, line `#24324d`, accent `#2dd4bf`. Set `color-scheme: light dark`. Remove the background gradients.
- Type: system UI stack, 13 px base in popup and in-page UI, 14 px in options. Radius 8 px controls, 12 px cards. Spacing scale 4/8/12/16/24.
- Every interactive element has a visible `:focus-visible` ring (2 px accent, 2 px offset). Minimum hit target 32 px. Text contrast at least 4.5:1 in both themes.

### Popup (360 px wide)

States, in priority order:

1. **Unsupported page** (non-http(s), or script unreachable): one line of explanation, only the "Edit profile" button.
2. **Profile incomplete** (missing first name, last name or email — use `REQUIRED_PROFILE_KEYS`, and make `profileCompleteness` use it too): warning card with "Complete profile" as the primary button; Fill is still available as secondary.
3. **Ready.**
4. **Result** (after a fill).

```
┌──────────────────────────────────────────┐
│ Job Fill                        ● Ready  │
│ jobs.example.com · Mapping: "Example"    │
├──────────────────────────────────────────┤
│ [        Fill this page   Alt+Shift+F  ] │
│ [ Map this form ]      [ Edit profile ]  │
├──────────────────────────────────────────┤
│ ☐ Autofill on this site                  │
│ Profile 12/20 ▓▓▓▓▓▓▓░░░░                │
└──────────────────────────────────────────┘

Result state (replaces the button block):
┌──────────────────────────────────────────┐
│ ✓ Filled 9 fields            [ Undo ]    │
│ ▸ Filled (9)                             │
│     First name        mapping            │
│     Email             heuristic          │
│ ▾ Left empty (3)                         │
│     How did you hear about us?           │
│     Cover letter                         │
│ [ Map the rest ]          [ Fill again ] │
│ Nothing was submitted.                   │
└──────────────────────────────────────────┘
```

- "Autofill on this site" toggles the origin in `autofillSites`; disabled with a hint when the site has no saved mapping.
- "Map the rest" starts map mode and closes the popup.
- Zero-filled result: "No matching empty fields" plus the "Left empty" list and "Map this form" as primary.
- The message area is `aria-live="polite"`. Buttons show a busy state while a fill runs.

### In-page UI (inside the shadow root)

- **Fill toast** (bottom right, 6 s, pauses on hover): "Filled 9 fields · 3 left" with **Undo** and **Dismiss**. Shown for keyboard-shortcut and autofill-on-load fills. Not shown when the popup triggered the fill (the popup shows the result).
- **Filled highlight:** 2 px teal box around each filled field for 1.6 s, respecting `prefers-reduced-motion`. Controlled by the existing "highlight filled" setting.
- **Map mode:**

```
┌────────────────────────────────────────────────────────────┐
│ Map mode — click a field to bind it.   2 mapped   [Done] ✕ │
└────────────────────────────────────────────────────────────┘
                                   ┌──────────────────────────┐
                                   │ Map this form        ⠿   │
                                   │ Name  [Example apply   ] │
                                   │ Pages [/jobs/*/apply   ] │
                                   │ ──────────────────────── │
                                   │ Selected: "LinkedIn"     │
                                   │ Fill with                │
                                   │  (•) Profile field [▾]   │
                                   │  ( ) Custom answer [   ] │
                                   │ [ Add ]                  │
                                   │ ──────────────────────── │
                                   │ Mapped (2)               │
                                   │  First name · #fname  ✕  │
                                   │  Email · email        ✕  │
                                   │ [ Save mapping ] [Cancel]│
                                   └──────────────────────────┘
```

  - Hover box amber, selected box teal, already-mapped fields get a small numbered badge matching the list.
  - The profile-field select is pre-set to the heuristic's best guess for the clicked field.
  - Default path pattern: the current path with id-like segments (all digits, or 8+ hex/UUID characters) replaced by `*`.
  - The panel is draggable by its header, and flips to the left side if it would cover the selected field.
  - Keyboard: Esc cancels; Tab moves through page fields; Enter selects the focused field; focus moves into the panel after selection and returns to the page after "Add".
  - Cancel with unsaved fields asks for confirmation inside the panel (no `window.confirm`).
  - A field may be mapped once per form; mapping it again replaces the earlier entry. Unlike today, several fields may map to the same profile key.

### Options page

Two-column layout: sticky left nav (collapses to top tabs under 720 px), content on the right, max width 960 px. Section is kept in the URL hash.

```
┌────────────────┬──────────────────────────────────────────┐
│ Job Fill       │ Profile                    Saved ✓ 14:02 │
│                │ Completeness 12/20 ▓▓▓▓▓▓░░░░            │
│ ▸ Profile      │ ── Identity ───────────────────────────  │
│   Answers      │ First name [      ]  Last name [      ]  │
│   Sites        │ Preferred  [      ]  Pronouns  [      ]  │
│   Settings     │ ── Contact ────────────────────────────  │
│   Backup       │ Email      [      ]  Phone     [      ]  │
│                │ ── Address ────────────────────────────  │
│ Stored only in │ ── Links ──────────────────────────────  │
│ this browser.  │ ── Work eligibility ───────────────────  │
│                │ ── Role and compensation ──────────────  │
└────────────────┴──────────────────────────────────────────┘
```

- **Profile:** grouped fieldsets as shown. Autosave on blur and after 600 ms idle, with a "Saved ✓ time" indicator; remove the Save/Reset buttons. Inline validation under the field (email shape, URLs must start with `http(s)://` — offer to prepend `https://`). Invalid values are not saved. Use proper `autocomplete` attributes so the browser can help fill the profile itself. Country and state are text inputs with a `datalist` from `regions.ts`.
- **Answers:** list of custom answers (question label + answer textarea), add/edit/delete, with a note that they are used only on fields you map them to.
- **Sites:** searchable list of saved mappings, one collapsible row each: name, origin + path pattern, field count, last updated, "Autofill on load" toggle, Open site, Delete. Expanded: editable name and pattern, field list with remove buttons. Delete shows an inline 6 s "Undo" bar instead of a confirm dialog. Empty state explains "Map this form".
- **Settings:** highlight filled fields; shortcut display with a link to `chrome://extensions/shortcuts` (open with `chrome.tabs.create`). Settings save on change.
- **Backup:** Export JSON; Import JSON showing a preview ("profile: 14 fields, 3 sites, 2 answers", plus validation errors) with Merge / Replace / Cancel; "Delete all data" behind a type-to-confirm field.

### Accessibility checks for this phase

- Full keyboard operation of popup, options and map mode.
- All inputs have programmatic labels; status changes use `aria-live`.
- Both themes pass contrast; nothing relies on color alone (icons or text accompany status colors).

**Done when:** `npm run build` output loads unpacked, and each state above is reachable. Add unit tests for the path-pattern default and for the options autosave validation logic; UI wiring itself is checked manually using the checklist below.

## Phase 6 — Cleanup

1. Replace `uuid` with `crypto.randomUUID()` and remove both `uuid` packages.
2. Add ESLint (typescript-eslint flat config) and scripts: `lint`, `check` = `tsc --noEmit && eslint . && vitest run`.
3. Update `README.md` (features, permissions rationale, usage) and the "Local conventions" in `AGENTS.md`.
4. Bump the version in `package.json` and `manifest.config.ts` to 1.1.0.
5. Append reusable learnings (native value setter, token-boundary matching, per-frame `executeScript`) to `E:\MyProjects\skill_repo\inbox\`, with no personal data.

## Manual test checklist (run after Phases 1, 3 and 5)

Build, load `dist/` unpacked, fill the profile, then on at least three real application pages (one embedded in an iframe, one React-based):

- [ ] Fill puts the right value in name, email, phone, location, LinkedIn fields, and the values survive clicking elsewhere on the page.
- [ ] Free-text questions ("How did you hear…", "Tell us about…") stay empty.
- [ ] Fields you typed in beforehand are untouched.
- [ ] Country/state dropdowns show the right option or stay unselected — never a wrong option.
- [ ] Yes/no radio questions are answered correctly; a group you already answered is untouched.
- [ ] Undo restores every filled field.
- [ ] Map mode: bind two fields, save, reload, fill — both come from the mapping.
- [ ] Nothing is submitted, and the Network panel shows no requests from the extension.
- [ ] Autofill on load fires only on a site where it was switched on.
