# Job Fill v1.1 — review fixes (brief for Cursor)

A code review of the v1.1 work found the bugs below. Fix them in the order given. `docs/CURSOR_PLAN.md` remains the design reference; this file overrides it where they differ.

## Ground rules

- `AGENTS.md` conventions still apply: vanilla TypeScript, no network, never submit a form, never overwrite a non-empty field.
- **Step 0: commit the current tree as-is** (`git add -A && git commit -m "v1.1 as delivered"`). Everything from v1.1 is currently uncommitted on top of the initial commit. Then make one commit per numbered fix.
- For every fix, add the listed test first and watch it fail, then fix. `npm run check` and `npm run build` must pass after each commit.
- Do not change dependency versions. TypeScript went from `~7.0.2` to `~5.8.0` during v1.1 without explanation: add one line to `README.md` saying why, or restore it if there was no reason.
- If a fix cannot be done as written, stop and say so.

## Reproduced results to turn into tests

`best(signals)` below means: the highest-scoring fill key over `FILL_KEYS`, or none if the score is under `CONFIDENCE_THRESHOLD`.

| Signals | Today | Required |
| --- | --- | --- |
| label "Email", group "Engineering Manager" | none | `email` |
| label "First name", group "Apply to Acme Company" | none | `firstName` |
| label "Are you legally authorized to work in the United States for any employer?" | none | `workAuthorized` |
| label "Will you require sponsorship from the company?" | none | `requiresSponsorship` |
| label "Middle name" | `fullName` 82 | none |
| label "Preferred pronouns" | `preferredName` 87 | `pronouns` |
| label "Preferred contact method" | `preferredName` 87 | none |
| label "Start date" | `noticePeriod` 110 | none |
| label "Current salary" | `salaryExpectation` 84 | none |
| label "Phone extension" | `phone` 83 | none |
| label "Phone country code" | `country` 85 | none |
| label "State your reason for leaving" | `state` 83 | none |
| label "How did you find our website?" | `portfolioUrl` 85 | none |
| label "Job title you are applying for" | `currentTitle` 87 | none |
| label "Name" | `fullName` | `fullName` (keep) |
| label "City" | `city` | `city` (keep) |
| label "Reference last name" | none | none (keep) |

Also reproduced:

- Radio group with options Yes, No; profile answer "no"; fill then undo → "No" stays checked while `restored` reports 1.
- `parseBackup` on a mapping field that has only `customAnswerId` returns the field without `customAnswerId` and with no error.

---

## High priority

### 1. Negative context blocks legitimate fills

Files: `src/shared/synonyms.ts`, `src/content/matcher.ts`.

- Apply negative context **only to personal keys**: `firstName`, `lastName`, `fullName`, `preferredName`, `pronouns`, `email`, `phone`, `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, `country`, `location`, `linkedinUrl`, `portfolioUrl`, `githubUrl`. Export this as `PERSONAL_KEYS`.
- Keep the existing rule for `currentCompany` and `currentTitle` (blocked by a negative token in the label unless the label says `current` or `present`).
- Never apply it to `workAuthorized`, `requiresSponsorship`, `salaryExpectation`, `howDidYouHear`, `noticePeriod`, `yearsExperience`.
- Split the token list:
  - `NEGATIVE_LABEL` (checked against label and aria-label): the current list plus plurals `references`, `referees`.
  - `NEGATIVE_GROUP` (checked against the group signal): only `reference`, `references`, `referee`, `referees`, `emergency`, `spouse`. Job-title words such as `manager`, `recruiter`, `company`, `school`, `university` must not block from a heading.
- Fix `getGroupContext`: use the closest `fieldset > legend`, else the nearest heading that **precedes the field inside the same `form`** (walk previous siblings of the field and of its ancestors up to the form). Never use an `h1`, and never use "the first heading in the enclosing `section`".

### 2. Loose single-word synonyms

Files: `src/shared/synonyms.ts`, `src/content/matcher.ts`.

- **Short-label rule:** a single-token synonym may match a label, aria-label or placeholder only when that text has at most 4 tokens after normalization. Multi-token synonyms and `name`/`id` signals are unaffected. Exempt `workAuthorized` and `requiresSponsorship` from this rule (their questions are long by nature).
- **Exact-only synonyms:** bare `name` (for `fullName`) matches only when the whole text equals `name`. Implement as an explicit `EXACT_ONLY` set, not a comment.
- **Synonym list edits:**
  - `preferredName`: remove `preferred`.
  - `noticePeriod`: remove `availability` and `start date`; add `earliest start date`, `available start date`.
  - `salaryExpectation`: remove bare `salary` and `compensation`.
  - `currentTitle`: remove bare `title` and `job title`; add `current job title`, `current position`.
- **Per-key blockers** (`BLOCKERS: Partial<Record<FillKey, string[]>>`; if any phrase appears as whole tokens in the label, that key scores 0):
  - `phone`: `extension`, `ext`, `type`, `country code`, `dial code`
  - `country`: `country code`, `dial code`, `phone`
  - `salaryExpectation`: `current`, `previous`, `last`
  - `currentTitle`: `applying`, `applied`, `desired`
  - Move the existing `addressLine1` regex (`line 2`, `apt`, `suite`, `unit`) into this table.

**Done when:** every row of the table above has a passing test, and the existing 45 tests still pass.

### 3. Undo does not restore radio groups

Files: `src/content/undo.ts`, `src/content/filler.ts`.

- Export `getRadioGroupMembers` from `filler.ts` (or move it to `matcher.ts` to avoid the `filler` ↔ `undo` import cycle).
- `capturePrevious` for a radio returns `{ kind: 'radio', checkedMember: HTMLInputElement | null }` for the whole group.
- Undo: if `checkedMember` is null, uncheck every member through the native `checked` setter and dispatch `input` and `change` on the one that was checked; otherwise `click()` the previous member.
- Count `restored` only when the state actually matches the snapshot afterwards.
- Test: fill "no" on a Yes/No group then undo → no member checked. Second test: pre-existing answers are never touched (already covered by empty-check; keep it).

### 4. Custom answers are unreachable

Files: `src/content/mapper-ui.ts`, `src/content/index.ts`, `src/content/filler.ts`, `src/shared/types.ts`, `src/shared/validate.ts`, `src/shared/messages.ts`.

- `FieldMapping.profileKey` becomes `FillKey` so a field can be mapped to `fullName` or `location`. Add labels for those two ("Full name", "Location (City, State)").
- Map-mode picker offers two choices: **Profile field** (select listing all fill keys, pre-set to the heuristic guess) or **Custom answer** (select of existing answers plus "New answer…", which shows a question input pre-filled with the field's label and an answer textarea).
- Pass `store.customAnswers` into `startMapMode`. New answers are saved with `saveCustomAnswers` when the mapping is saved, not before.
- `parseFields` in `validate.ts`: keep `customAnswerId` when it is a UUID; drop the field with an error when it has neither a valid `profileKey` nor a valid `customAnswerId`. Accept `fullName` and `location` as `profileKey`.
- Remove the `'howDidYouHear'` placeholder key in `fillPage`: let `setControlValue` take `FillKey | null`, and give `FilledField` a display string `target` (profile label, or the custom answer's question) with `key` optional.
- Tests: `parseBackup` round-trips a custom-answer field; `fillPage` fills a mapped custom answer into a textarea and a select, and reports `source: 'custom'` with the question as `target`.

### 5. Backup import can destroy data

Files: `src/options/main.ts`, `src/shared/validate.ts`, new `src/shared/mergeStores.ts`.

- `ParseBackupResult` gains `fatal: boolean` (true for invalid JSON or a non-object root). When fatal, show the error and keep Merge and Replace disabled. Both are also disabled until a file is chosen.
- New pure function `mergeStores(current, incoming): Store`:
  - Profile: an incoming value replaces the current one only when it is non-empty.
  - Mappings and custom answers: same `id` → replace with the incoming entry; otherwise append. No duplicates after importing your own export twice.
  - `autofillSites`: union. `highlightFilled`: keep current.
- Replace needs an inline confirmation step ("Replace all current data? Confirm / Cancel"); no `window.confirm`.
- Tests for `mergeStores`: blank incoming profile keeps the current profile; importing the same export twice leaves counts unchanged; `fatal` is set for invalid JSON.

### 6. Profile autosave rebuilds the form

File: `src/options/main.ts`.

- `queueProfileSave` must not call `renderProfile()`. After saving, update in place: the "Saved ✓ HH:MM" text, the completeness count, and the progress bar width.
- Use one debounce timer per field, not the shared `saveTimer`.
- When a field is invalid, save the other fields anyway and keep the previous stored value for the invalid one; show the error under that field only.
- Extract the "which values get saved" logic into a pure function in `src/shared/profileValidation.ts` and test it. Manual check: type slowly in any field for 5 seconds — focus and caret never move, and "Saved ✓" appears.

### 7. Shortcut feedback and toast

Files: `src/background/index.ts`, `src/shared/tabApi.ts`, `src/content/index.ts`, `src/content/ui/host.ts`, `src/shared/messages.ts`.

- Add `toast(summary)` to the frame API. After the keyboard command's `fillTab`, the background aggregates the results and shows one toast in the top frame (`frameIds: [0]`, passing the counts through `args`): "Filled 9 fields · 3 left", or "No matching empty fields" when nothing was filled. The popup path still shows no toast.
- The toast's Undo sends `{ type: 'UNDO_TAB' }` to the background, which calls `undoTab(sender.tab.id)` so every frame is undone. The autofill-on-load toast may stay per-frame with a local undo.
- Toast behaviour: Dismiss and Undo both hide it; showing a new toast cancels the previous hide timer; hovering pauses the timer; `role="status"`.
- Delete the dead message path: `FILL_PAGE`, `UNDO_FILL`, `START_MAP_MODE`, `STOP_MAP_MODE`, `PING`, `handleContentMessage`, and the content-script `onMessage` listener. `Message` should contain only `UNDO_TAB`. The background `onMessage` handles only that.

---

## Medium priority

### 8. Popup and embedded (iframe) forms

- Add `frameInfo(tabId)` to `tabApi.ts`, returning `{ frameId, href, origin, fillable }` per frame.
- The popup treats the frame with the most fillable fields as the form frame and uses **its** URL for the mapping lookup and **its** origin for the "Autofill on this site" toggle. When that origin differs from the tab's, show "Form hosted on <host>" in the header line.

### 9. Autofill-on-load watcher

- Start the `MutationObserver` whenever the first attempt filled nothing; remove the `collectFillableElements().length > 0` early return (`content/index.ts:87`).
- Set `userTyped` only for `event.isTrusted` input events, so the extension's own synthetic events do not count.
- Out of scope for now, but note it in the README as a known limit: in-page navigation and later steps of multi-step forms are not refilled automatically.

### 10. Radio group identity

- In `radioGroupKey`, identify the `role="radiogroup"` container and the owning form by object identity (a module-level `WeakMap<Element, number>` counter), not by `id`, `aria-labelledby` or `outerHTML.length`.
- A radio with no `name` and no radiogroup container is its own group.
- Test: two radiogroups with identical markup and no ids are collected as two fields and both get answered.

### 11. Map mode rebuild

Bring `mapper-ui.ts` up to the spec in `docs/CURSOR_PLAN.md` Phase 5:

- Build with `h()` from `src/ui/dom.ts`; no `innerHTML` templates. Style through the token variables (inline `tokens.css` into the shadow root) so dark mode works.
- Banner shows the mapped count and a Done button.
- Clicking any radio in a group selects the group (resolve to the representative), and the click never changes the page's radio state.
- Already-mapped fields get a numbered badge matching the list.
- Keyboard: Tab through page fields, Enter selects, focus moves into the panel and back after Add; Esc cancels.
- Cancel with unsaved fields asks for confirmation inside the panel.
- Panel is draggable by its header and moves aside if it covers the selected field.
- Compute the fillable list once when map mode starts and refresh it on DOM mutations (debounced), instead of on every `mouseover`.

### 12. Sites page

- Add a Remove button per mapped field (use the existing, currently unused `deleteFieldMapping`).
- Show a custom entry as "Custom: <question>", not the raw id.

### 13. Smaller items

- `extractSignals` label lookup should query `el.getRootNode()` rather than `document`, so fields inside open shadow roots find their labels.
- Remove unused exports: `MatchCandidateLegacy`, `hideHostToast` (unless fix 7 uses it), `clearUndoSnapshot`, `hasUndoSnapshot`, `createDefaultStore`, `isUuid`, `isProfileKey`.
- Popup result rows: show the target ("First name") next to the page label, as in the plan's wireframe.
- Production build: turn off `build.sourcemap` for `vite build` (keep it in dev), so source maps are not listed in `web_accessible_resources`. Check the CRXJS docs for whether `use_dynamic_url` can be enabled for content-script assets; enable it if supported.

---

## After the fixes

1. Run the manual checklist at the end of `docs/CURSOR_PLAN.md` on at least three real application pages (one React-based, one embedded in an iframe) and record the result of each item in the PR or commit message. This has not been done by anyone yet.
2. Report honestly: list any item that was skipped or only partly done, rather than marking the phase delivered.

## Not in this round

- Custom dropdown (combobox) support.
- Refill on in-page navigation and multi-step forms.
- Narrowing host permissions.
