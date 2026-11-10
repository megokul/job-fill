# Chrome Web Store — publish checklist

## Host access decision (v1)

**Keep broad `http://*/*` and `https://*/*` host permissions for first publish.**

Job applications and ATS iframes span many domains; optional per-site host permission is a follow-up if review requires it. Justification text is in `STORE_LISTING.md`.

## Privacy policy URL

https://megokul.github.io/job-fill/privacy.html

Source: `docs/privacy.html` on the `job-fill` GitHub repo (GitHub Pages from `/docs`). Confirm the URL returns 200 after Pages is enabled.

## Developer account registration

1. Open https://chrome.google.com/webstore/devconsole  
   (Opened in the Cursor browser this session — stopped at Google Sign-in.)
2. Sign in with the Google account that should own the listing (recommended: nvgokulkrishna@gmail.com).
3. Pay the one-time Chrome Web Store developer registration fee when prompted.
4. Complete the publisher profile (display name, contact email).

**Blocked on you:** Google login + one-time developer fee. No agent can complete those.

## Package

```bash
npm run package
```

Zip ready locally: `release/job-fill-1.1.0.zip`. The package script refuses to zip if production `dist/` contains an open shadow-root marker.

**Upload:** after the developer account exists, create a new item in the dashboard and upload that zip. Listing copy + assets: `docs/STORE_LISTING.md` and `docs/store-assets/`.

## Listing fields

Copy from `docs/STORE_LISTING.md`. Upload screenshots and promo tiles from `docs/store-assets/`. Set privacy policy URL as above.

## After submit

- Wait for review.
- If reviewers ask to narrow host access, plan the optional-permissions redesign before resubmitting.
