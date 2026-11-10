# Job Fill — Privacy Policy

**Effective date:** 10 November 2026  
**Public URL:** https://megokul.github.io/job-fill/privacy.html

This policy describes how the Job Fill Chrome extension handles data.

## What is stored

Job Fill keeps the following in the browser, under `chrome.storage.local` on this device only:

- **Profile** — name, contact, address, links, work-authorization answers, and related fields you enter in Options.
- **Form mappings** — per-site field mappings you create in Map mode (selectors / match signals and which profile key or custom answer to use).
- **Custom answers** — free-text answers you create and optionally map to fields.
- **Settings** — including which origins may autofill on load, and whether filled fields are highlighted.

## What is not transmitted

Autofill does not send profile data, mappings, answers, or page contents to any server. There are no analytics, accounts, or sync endpoints in the extension. Filling runs in the page via local content scripts and `chrome.scripting`.

Job Fill does not sell or share personal data with third parties.

## Export and delete

- **Export** — Options → export writes a JSON backup of the stored data to a file you choose on your device.
- **Import** — Options → import can merge or replace from a JSON file you select.
- **Delete** — Remove the extension (Chrome deletes its `chrome.storage.local` data), or clear/replace data via Options and import. There is no cloud copy to erase.

## Permissions note

Host access (`http://*/*`, `https://*/*`) is used so the extension can run on application pages and in cross-origin iframes that host the form. See the Chrome Web Store listing permission justifications for details.

## Contact

Questions about this policy: [nvgokulkrishna@gmail.com](mailto:nvgokulkrishna@gmail.com).
