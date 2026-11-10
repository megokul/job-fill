# Job Fill — production readiness (brief for Cursor)

The fill engine and UI pass review at unit level (84 tests). This brief covers what is still needed before the extension can be relied on or published. Work through the parts in order; Part A comes first because it will show which later items actually matter.

## Ground rules

- `AGENTS.md` conventions apply: vanilla TypeScript in the extension, no network calls, never submit a form, never overwrite a non-empty field.
- Failing test first, one commit per numbered item, `npm run check` and `npm run build` green after each.
- Where this brief says "verify against the docs", read the current Playwright, Chrome extension or CRXJS documentation before coding. Several API details below are from memory and may be out of date.
- New **dev** dependencies allowed without asking: `@playwright/test`, `react`, `react-dom`, `react-select` (test fixtures only — never imported from `src/`), and one zip library for packaging. Nothing else.
- If something cannot be done as written, stop and report it. Do not mark an item done on the strength of unit tests when it asks for a browser test.

---

## Part A — End-to-end tests in a real browser

Goal: the manual checklist in `docs/CURSOR_PLAN.md` becomes an automated suite that loads the built extension in Chromium.

### A1. Harness

- Add Playwright under `e2e/`, with `npm run e2e` (builds first) and its own `playwright.config.ts`. Keep it out of `npm run check`; add `npm run check:all` that runs both.
- Load the extension from `dist/` with a persistent context and the `--disable-extensions-except` / `--load-extension` arguments. Verify against the Playwright docs how to do this and whether headless is supported in the installed version; if not, run headed.
- Get the extension's service worker from the context and use it to:
  - seed `chrome.storage.local` with a test profile, mappings and custom answers before each test;
  - trigger a fill on a tab by calling `chrome.scripting.executeScript` with `allFrames: true` and `globalThis.__jobFill.fill()` — the same call `fillTab` makes. Keyboard-command shortcuts cannot be triggered reliably from Playwright; do not try.
- Popup tests: open `chrome-extension://<id>/src/popup/index.html?tabId=<n>` as a normal page. Add support in `src/popup/main.ts` for an optional `tabId` query parameter that replaces the active-tab lookup. This is the only production code change A1 needs.
- Serve fixtures from two local origins so cross-origin iframes are real, for example `http://localhost:4173` and `http://127.0.0.1:4174`, started by Playwright's `webServer` setting.

### A2. Fixtures (`e2e/fixtures/`, hand-written, no markup copied from real sites)

1. `plain.html` — labelled inputs, `autocomplete` attributes, native selects (country and state with numeric values), yes/no radio fieldsets, a select wrapped in a label.
2. `react/` — a small React app built by Vite as a separate fixture build, with **controlled** inputs, a controlled select, controlled radios, and client-side "required" validation that reads React state. It shows the current state as JSON in a `<pre data-testid="state">` so tests can assert what React actually holds.
3. `embedded.html` on origin 1 containing an iframe that loads `plain.html` from origin 2.
4. `late.html` — the form is inserted 2 seconds after load, and a search input exists in the header from the start.
5. `distractors.html` — references section, emergency contact, free-text questions, a newsletter checkbox.
6. `hidden.html` — see Part B.
7. `submit-trap.html` — a form whose `submit` event and any click on its submit button set `window.__submitted = true`.

### A3. Test cases

- Plain: every expected field has the right value; free-text questions are empty; a pre-typed field is untouched.
- React: after fill, the JSON state matches the profile (proves the values reached React, not just the DOM); after blurring every field the values are still there; undo returns the state to empty.
- Embedded: the fields inside the cross-origin iframe are filled; undo clears them.
- Late: with the origin in `autofillSites`, the form is filled without any trigger within 5 seconds of appearing; with the origin not listed, nothing is filled.
- Distractors: none of the reference, emergency or free-text fields is filled; the newsletter checkbox stays unchecked.
- Submit trap: after fill, undo and a second fill, `window.__submitted` is still undefined.
- No network: record all requests made by the extension's service worker and content scripts during a fill; assert there are none beyond the fixture pages themselves.
- Map mode: start it, click a field, add a profile mapping and a new custom answer, save; reload; fill; both fields come from the mapping (`source` is `mapping` / `custom`).
- Popup (via `?tabId=`): ready state shows the host; Fill shows the result list with filled and left-empty entries; Undo restores; on the embedded page the header shows "Form hosted on …".
- Options: typing in a profile field keeps focus and shows "Saved ✓"; export then import-merge leaves counts unchanged; an invalid file leaves Merge and Replace disabled.

**Done when:** `npm run e2e` passes locally and the report lists each case above by name. Report any case that fails because of a product bug rather than adjusting the test to pass — those failures are the point of this part.

---

## Part B — Hidden-field protection

A page can hide extra fields to harvest data on a Fill click. `isVisible` in `src/content/matcher.ts` only rejects `display: none`, `visibility: hidden`, `opacity: 0` and zero size.

1. For text inputs, textareas and selects, treat the control as not fillable when any of these holds:
   - `el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })` is false (use it when the method exists; verify the option names against the docs);
   - the control or any ancestor has computed opacity below 0.1;
   - width or height is under 4 px;
   - its box lies entirely outside the document (right or bottom edge at or before 0, or left or top beyond the document's scroll size);
   - it is clipped to nothing (`clip-path: inset(50%)` or the legacy `clip: rect(0 0 0 0)` pattern);
   - it or an ancestor has `aria-hidden="true"` or `inert`.
2. Radios and checkboxes are often visually hidden behind a styled label. For those, apply the rules above to the associated label (wrapping label or `label[for]`) instead of the input; if there is no label, apply them to the input.
3. E2E fixture `hidden.html`: one visible email field plus phone and address fields hidden by each technique above. After fill, only the visible field has a value. Include one custom-styled radio group (input clipped to 1 px, visible label) that must still be answered.
4. Unit tests for the pure parts (the geometry and style checks, with injected rect and style values).

---

## Part C — Custom dropdowns (comboboxes)

Many application forms use scripted dropdowns instead of native `<select>`. They are currently skipped.

1. **Make filling asynchronous.** `fillPage` and the frame API's `fill` become `async`; update callers and tests.
2. **Shared option picker.** Extract the matching rules in `selectOption` into a pure `pickOption(options: { text: string; value?: string }[], wanted: string, key: FillKey | null): number` (index or -1): exact match, yes/no tokens, state and country aliases, whole-token prefix. Native selects and comboboxes both use it. Never fall back to substring matching.
3. **Detection.** In `collectFillableElements`, classify a control as a combobox when it is an `input` with `role="combobox"` (or inside an element with that role), or a `button`/`div` with `aria-haspopup="listbox"`. Its label comes from the usual label lookup plus `aria-labelledby`.
4. **Fill procedure** (only for keys with a closed set of answers: `country`, `state`, `location`, `workAuthorized`, `requiresSponsorship`, and mapped custom answers):
   - Open it: for an input, focus and set the wanted text through the native setter with an `input` event; for a button-style control, dispatch a click.
   - Wait up to 1500 ms for options (`[role="option"]` inside the element referenced by `aria-controls` / `aria-owns`, else any newly added `[role="listbox"]`).
   - Choose with `pickOption`. If there is a confident match, activate it with `mousedown`, `mouseup` and `click` events on the option; verify afterwards that the control shows the chosen text.
   - If there is no match, or verification fails: restore the original text, close the dropdown (Escape key event, then blur), and report the field under `unmatched`. Never leave a dropdown open and never leave typed text behind.
5. **Undo:** best effort — restore the previous text through the native setter and dispatch `input`/`change`. Document in the README that undo may not clear a scripted dropdown's internal selection.
6. **Fixtures and tests:** add to the React fixture one `react-select` single-select (country), one type-ahead that loads options after 300 ms (location), and one button-style listbox (yes/no). E2E: each ends with the right selection in React state; a value with no matching option leaves the control exactly as it was. Unit tests for `pickOption`, including the earlier "US must not pick Australia" and "CA must not pick American Samoa" cases.

---

## Part D — Multi-step forms and in-page navigation

Applies only on origins listed in `autofillSites`. Manual Fill is unchanged.

1. After the first autofill, keep watching instead of disconnecting after 15 seconds: refill when the URL changes (use the Navigation API's success event where available, else compare `location.href` once a second) or when fillable fields appear that did not exist at the previous fill.
2. Limits: debounce 500 ms; only empty fields; at most 10 automatic fills per page load; stop for the rest of the page load when the user clicks Undo on an autofill toast.
3. Each automatic fill that changes anything shows the toast with Undo. A fill that changes nothing shows nothing.
4. The watcher must cost nothing on unlisted origins (keep the existing early return).
5. E2E fixture `wizard.html`: step 1 has name and email, a Next button swaps in step 2 with address fields and changes the URL with `history.pushState`. Both steps end up filled without a trigger; clicking Undo on step 2 stops further automatic fills. Remove the matching "Known limits" line from the README once this passes.

---

## Part E — Product gaps

1. **First run.** On `chrome.runtime.onInstalled` with reason `install`, open the options page.
2. **Undo after the popup closes.** Add `canUndo()` to the frame API. When any frame reports true, the popup's ready state shows "Undo last fill".
3. **Scope statement.** README section stating plainly: English-language forms only; state and province lists cover the US and Canada; resume upload and file fields are never touched.

## Part F — Release engineering

1. **CI.** `.github/workflows/ci.yml`: install, `npm run check`, `npm run build`, then the E2E suite (install the Playwright browser; use a virtual display if the suite must run headed). Do not add deployment steps.
2. **Packaging.** `npm run package` builds and writes `release/job-fill-<version>.zip` containing the contents of `dist/`. Add `release/` to `.gitignore`.
3. **Docs.** Add `CHANGELOG.md` covering 1.0.0 → current. Do **not** add a licence file; the owner chooses the licence.
4. **Store drafts** (text only, for the owner to edit):
   - `docs/PRIVACY.md` — what is stored (profile, mappings, answers, settings), where (`chrome.storage.local` on the device), that nothing is transmitted, how to export and delete it. State only what the code does.
   - `docs/STORE_LISTING.md` — single-purpose statement and a one-paragraph justification for each permission in the manifest (`storage`, `scripting`, `activeTab`, host access to all sites and why iframes require it). If `activeTab` turns out to be unused given the host permissions, say so and remove it from the manifest in its own commit.

## Not for this round — owner decisions

Do not start these; list them as open in your report.

- **Icons.** The current files are placeholders. Real artwork is needed at 16, 48 and 128 px.
- **Narrowing host access** to per-site permission granted on first use. This changes how every entry point works and needs a design decision first.
- **Licence, store account and listing images.**

## Reporting

End with a table: each item above, its commit, and one of *done and browser-tested*, *done, unit-tested only*, *partly done* (say what is missing), or *not done*. List every E2E case that fails or was skipped, with the reason.
