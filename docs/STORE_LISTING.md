# Job Fill — Chrome Web Store listing

Use this copy when creating the listing. Artwork lives in `docs/store-assets/`. Privacy policy URL: https://megokul.github.io/job-fill/privacy.html

## Store fields

| Field | Value |
| --- | --- |
| Name | Job Fill |
| Summary (short) | Autofill job applications from a local profile — no account, no cloud sync. |
| Category | Productivity |
| Language | English |
| Privacy policy URL | https://megokul.github.io/job-fill/privacy.html |

## Detailed description

Job Fill autofills job application forms from a profile stored locally in your browser.

- Matches fields by labels, autocomplete attributes, and optional per-site mappings
- Supports custom answers for mapped questions
- Works across frames, including forms inside cross-origin iframes
- Never submits the application for you
- Never overwrites fields you already typed
- No network calls for autofill — data stays on your device

Open Options to complete your profile, then use Fill on an application page (or Alt+Shift+F). Use Map mode for stubborn fields. Enable autofill-on-load only for sites you choose.

## Single-purpose statement

Job Fill autofills job application forms from a profile stored locally in the browser. It matches fields by labels and attributes, optional per-site mappings, and custom answers. It does not submit forms, upload resumes, or send profile data over the network.

## Permission justifications

### `storage`

Stores the user’s profile, form mappings, custom answers, and settings in `chrome.storage.local` so autofill works offline and without an account.

### `scripting`

Used to call the content-script frame API (`fill`, `undo`, map mode, frame info) in every frame of the active application tab via `chrome.scripting.executeScript`, including cross-origin iframes that contain the form.

### Host access (`http://*/*`, `https://*/*`)

Job applications appear on many employer and ATS domains, often with the form inside a cross-origin iframe. Broad host access lets the content script and `scripting` API reach those frames. Autofill still only writes into empty fields the matcher or mapping targets; it does not scrape pages for a remote service.

**v1 decision:** keep broad host access for first publish. Per-site optional host permission remains a possible follow-up if Chrome Web Store review requires it.

### `activeTab` (removed)

Previously unused given host permissions for `http(s)://*/*`. Popup and keyboard-command flows use `scripting` with those hosts rather than temporary `activeTab` grants, so it was removed from the manifest.

## Artwork checklist

| Asset | Path | Size |
| --- | --- | --- |
| Extension icon | `public/icons/icon-128.png` (also 16, 48) | 128×128 |
| Screenshot — Options | `docs/store-assets/screenshot-options-1280x800.png` | 1280×800 |
| Screenshot — Popup | `docs/store-assets/screenshot-popup-1280x800.png` | 1280×800 |
| Small promo | `docs/store-assets/promo-small-440x280.png` | 440×280 |
| Large promo | `docs/store-assets/promo-large-920x680.png` | 920×680 |
| Marquee promo | `docs/store-assets/promo-marquee-1400x560.png` | 1400×560 |
