# Chrome Web Store — publish checklist

## Host access decision (v1)

**Keep broad `http://*/*` and `https://*/*` host permissions for first publish.**

Job applications and ATS iframes span many domains; optional per-site host permission is a follow-up if review requires it. Justification text is in `STORE_LISTING.md`.

## Privacy policy URL

https://megokul.github.io/job-fill/privacy.html

Source: `docs/privacy.html` on the `job-fill` GitHub repo (GitHub Pages from `/docs`). Confirm the URL returns 200 after Pages is enabled.

## Developer account registration

1. Open https://chrome.google.com/webstore/devconsole
2. Sign in with the Google account that should own the listing (recommended: the account behind nvgokulkrishna@gmail.com).
3. Pay the one-time Chrome Web Store developer registration fee when prompted.
4. Complete the publisher profile (display name, contact email).

This step requires your Google login and payment method; it cannot be finished by an automated agent.

## Package

```bash
npm run package
```

Upload `release/job-fill-1.1.0.zip` (version may bump). The package script refuses to zip if production `dist/` contains an open shadow-root marker.

## Listing fields

Copy from `docs/STORE_LISTING.md`. Upload screenshots and promo tiles from `docs/store-assets/`. Set privacy policy URL as above.

## After submit

- Wait for review.
- If reviewers ask to narrow host access, plan the optional-permissions redesign before resubmitting.
