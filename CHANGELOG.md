# Changelog

## 1.1.0

### Added

- Playwright end-to-end suite that loads the built extension and covers plain, React, iframe, late-rendered, distractor, hidden, submit-trap, map-mode, popup, options, combobox, and wizard flows.
- Hidden-field harvest protection (opacity, clip, off-document geometry, `aria-hidden` / `inert`, tiny boxes).
- Scripted combobox / listbox filling for closed-set answers (country, state, location, work authorization, sponsorship, custom answers), with shared `pickOption` matching.
- Multi-step autofill watcher on origins listed in `autofillSites` (URL changes and newly appeared empty fields; Undo stops further automatic fills).
- Open the options page on first install.
- Popup **Undo last fill** when any frame still has an undo snapshot.
- `npm run package` release zip and CI workflow.

### Changed

- `fillPage` / frame `fill` are asynchronous so combobox option menus can be awaited.
- README scope: English-language forms; US/Canada regions; file uploads never filled.

### Fixed

- Matcher and storage review fixes from the v1.1 hardening pass (negative context, synonyms, radio identity, map-mode UI, custom-answer merge, late fields, and related unit coverage).

## 1.0.0

- Initial Manifest V3 extension: local profile autofill, heuristic matching, manual mappings, custom answers, multi-frame fill, undo, popup/options UI, import/export backups.
- No network calls for autofill; never submits application forms; never overwrites non-empty fields.
