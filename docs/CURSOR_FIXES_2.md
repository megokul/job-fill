# Job Fill — second review fixes (brief for Cursor)

The 13 fixes from `docs/CURSOR_FIXES.md` were reviewed and hold up. Four matcher issues remain, plus one small storage issue. All are confined to `src/content/matcher.ts`, `src/shared/synonyms.ts` and `src/content/index.ts`.

## Ground rules

- Same as before: `AGENTS.md` conventions, failing test first, one commit per fix, `npm run check` and `npm run build` green after each.
- Do not loosen any existing test. All 72 current tests, including `review-table.test.ts`, must still pass unchanged.
- Add the new cases to `src/content/review-table.test.ts` (or a sibling file) so the label tables stay in one place.

## 1. Controls wrapped in a `<label>` get polluted label text

**Reproduced.** For

```html
<label>Country <select id="c"><option value="">Select...</option><option value="14">Australia</option><option value="231">United States of America</option></select></label>
```

`extractSignals` returns the label `"Country Select...AustraliaUnited States of America"`. The short-label rule then rejects the single-token synonym `country`, so the select is not filled. The same select with a separate `<label for="c">Country</label>` fills correctly. The polluted text is also what the popup shows as the field label.

Fix, in `getAssociatedLabelText` (`matcher.ts`):

- Add a helper `labelOwnText(label: Element): string` that clones the label, removes every `select`, `input`, `textarea`, `button`, `datalist` and `option` from the clone, and returns the remaining `textContent` with whitespace collapsed.
- Use it for both the wrapping label and each `label[for]` hit.
- Deduplicate identical parts before joining (today a field with both a wrapping label and a `for` label yields `"Country Country"`).
- Apply the same helper in `optionLabel` in `filler.ts`.

Tests:

- The markup above: signal label is exactly `Country`; `fillPage` with `country: 'United States'` selects value `231`.
- A wrapped text input `<label>Email <input></label>` still yields `Email`.
- A field with both label styles yields the text once.

## 2. Common salary labels no longer match

**Reproduced.** These all return no match today and must return `salaryExpectation`:

| Label | Required |
| --- | --- |
| Salary expectations | `salaryExpectation` |
| Salary | `salaryExpectation` |
| Desired compensation | `salaryExpectation` |
| Compensation expectations | `salaryExpectation` |
| Expected annual salary | `salaryExpectation` |
| What are your salary expectations? | `salaryExpectation` |
| What is your desired salary? | `salaryExpectation` (already passes; keep) |
| Current salary | none (keep) |
| What is your current salary? | none (keep) |
| Salary history | none |

Fix, in `synonyms.ts`:

- Restore the bare synonyms `salary` and `compensation`. The short-label rule already keeps them off long questions, and the existing blockers (`current`, `previous`, `last`) keep them off the wrong fields.
- Add the plural and variant phrases: `salary expectations`, `compensation expectations`, `desired compensation`, `salary range`.
- Add `history` to the `salaryExpectation` blockers.

Do not add general stemming or plural folding; add explicit phrases only.

## 3. `urls[LinkedIn]`-style field names no longer match

**Reproduced.** `name="urls[LinkedIn]"` and `name="urls[GitHub]"` return no match, because `splitIdentifier` turns them into `linked in` and `git hub`. `urls[Portfolio]` still matches.

Fix, in `scoreField` (`matcher.ts`):

- For each of `name` and `id`, add two haystacks: the split form (as today) and the unsplit normalized form. Take the best score.
- Replace the string-equality `isNameOrId` check with an explicit haystack kind. Haystack entries should carry `kind: 'label' | 'aria' | 'placeholder' | 'ident'`, and the short-label rule should skip `ident`.

Tests (signals with `name` only):

| name | Required |
| --- | --- |
| `urls[LinkedIn]` | `linkedinUrl` |
| `urls[GitHub]` | `githubUrl` |
| `urls[Portfolio]` | `portfolioUrl` (keep) |
| `firstName` | `firstName` (keep) |
| `address2` | `addressLine2` (keep) |
| `question_12345` | none (keep) |

## 4. A heading from an earlier section blocks later fields

**Reproduced.** In

```html
<form>
  <div><h3>Personal details</h3><label for="a">Email</label><input id="a"></div>
  <div><h3>References</h3><label for="b">Reference email</label><input id="b"></div>
  <div><label for="c">Phone</label><input id="c"></div>
  <div><h3>Emergency contact</h3><label for="d">Phone number</label><input id="d"></div>
</form>
```

only `a` matches. Field `c` ("Phone") is blocked because `getGroupContext` finds the `References` heading nested inside the preceding sibling `div`, which is a different section.

Fix, in `getGroupContext`:

- A heading nested inside a previous sibling counts only when that sibling contains **no** form controls (`input`, `select`, `textarea`). A sibling with controls is another section: skip it and keep walking.
- A heading that is itself a previous sibling (`<h3>` directly before the field's row) is unchanged.

Tests:

- The markup above: `a` → `email`, `c` → `phone`, `b` and `d` unmatched.
- Header-wrapper layout still blocks: `<div class="head"><h3>Emergency contact</h3></div><div><label for="p">Phone</label><input id="p"></div>` → `p` unmatched.

## 5. New custom answers are saved against a stale list

From reading the code, not reproduced. In `runStartMapMode` (`content/index.ts`), `onSave` writes `[...store.customAnswers, ...newAnswers]` using the store read when map mode started. An answer edited or deleted in Options while map mode is open is overwritten.

Fix:

- In `onSave`, read the store again and merge by `id` (current answers, then new ones) before calling `saveCustomAnswers`.
- Save only the pending answers that a field in the final mapping still references; drop ones whose field was removed.

Test: extract the merge into a small pure function and cover both rules.

## 6. Tidy-up (one commit)

- Remove the deprecated `NEGATIVE_CONTEXT` and `hasNegativeContext` exports if nothing uses them.
- In `scoreField`, the single-token `tokenOverlap` branch can no longer trigger differently from `hasConsecutiveTokens`; remove it and the helper if tests confirm.
- `UndoEntry.fillKey` is no longer read (`void fillKey` in `undo.ts`); remove the field and the placeholder `'howDidYouHear'` passed for custom answers in `filler.ts`.

## After the fixes

The manual checklist at the end of `docs/CURSOR_PLAN.md` is still entirely unchecked. It needs a person to load `dist/` unpacked in Chrome. Do not mark it done; list it as outstanding in your report.
