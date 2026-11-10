# Job Fill — Chrome Web Store listing draft

**Edit before publishing.** Text only; artwork and the developer account are owner decisions.

## Single-purpose statement

Job Fill autofills job application forms from a profile stored locally in the browser. It matches fields by labels and attributes, optional per-site mappings, and custom answers. It does not submit forms, upload resumes, or send profile data over the network.

## Permission justifications

### `storage`

Stores the user’s profile, form mappings, custom answers, and settings in `chrome.storage.local` so autofill works offline and without an account.

### `scripting`

Used to call the content-script frame API (`fill`, `undo`, map mode, frame info) in every frame of the active application tab via `chrome.scripting.executeScript`, including cross-origin iframes that contain the form.

### Host access (`http://*/*`, `https://*/*`)

Job applications appear on many employer and ATS domains, often with the form inside a cross-origin iframe. Broad host access lets the content script and `scripting` API reach those frames. Autofill still only writes into empty fields the matcher or mapping targets; it does not scrape pages for a remote service.

### `activeTab` (removed)

Previously unused given host permissions for `http(s)://*/*`. Popup and keyboard-command flows use `scripting` with those hosts rather than temporary `activeTab` grants, so it was removed from the manifest.
