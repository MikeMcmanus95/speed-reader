# Chrome Web Store Production Readiness

Last reviewed: 2026-03-07

This document tracks production-readiness requirements for publishing the
Speed Reader extension in the Chrome Web Store and maps each requirement to
current repo status.

## Build and Package Commands

- Build (deterministic from clean workspace):  
  `pnpm --filter @speed-reader/extension build`
- Create upload ZIP artifact:  
  `pnpm --filter @speed-reader/extension package`

The package command generates `apps/extension/dist/speed-reader-rsvp-v<version>.zip`.

## Requirement Matrix

| Requirement | Source | Status | Evidence / Action |
| --- | --- | --- | --- |
| Upload a valid ZIP package (max 2GB) with valid manifest metadata | https://developer.chrome.com/docs/webstore/publish/ and https://developer.chrome.com/docs/webstore/prepare | Met (repo) | `package` script now creates upload ZIP from `dist/`; manifest is generated in build output. |
| Manifest must include correct release metadata (`name`, `version`, `icons`, `description` <= 132 chars) | https://developer.chrome.com/docs/webstore/prepare | Met (repo) | `apps/extension/manifest.json` includes required fields; description length is 97 chars. |
| Listing metadata must be complete and accurate (missing description/icon/screenshots causes rejection) | https://developer.chrome.com/docs/webstore/program-policies/listing-requirements | Partial (dashboard) | Repo has extension icon assets; dashboard listing must be completed with screenshots and accurate metadata before submit. |
| Store listing should include required promotional assets (128x128 icon, at least one 1280x800 screenshot, YouTube promo video, 440x280 small promo tile) | https://developer.chrome.com/docs/webstore/cws-dashboard-listing | Gap (dashboard) | Assets/links must be uploaded in Web Store listing flow. |
| Privacy tab must declare single purpose, minimum-permission justifications, remote-code declaration, and data-use disclosures | https://developer.chrome.com/docs/webstore/cws-dashboard-privacy | Gap (dashboard) | Must be completed in dashboard for this item before review submission. |
| Privacy disclosures must match extension behavior and privacy policy URL | https://developer.chrome.com/docs/webstore/program-policies/listing-requirements and https://developer.chrome.com/docs/webstore/cws-dashboard-privacy | Gap (policy + dashboard) | Public privacy policy URL and matching disclosures are required prior to submission. |
| MV3 policy: extension logic must be self-contained, no remotely hosted executable code | https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements | Met (repo) | Extension code is bundled locally; sidepanel no longer references external Google Fonts URLs. |
| Request only permissions needed for single purpose; broad permissions can increase review time | https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings and https://developer.chrome.com/docs/webstore/review-process | Met (repo) | Manifest now uses user-gesture-scoped `activeTab` + `scripting` extraction and avoids always-on host permissions. |
| Must provide real, non-broken functionality with user value | https://developer.chrome.com/docs/webstore/program-policies/minimum-functionality | Validation gate | Runtime flow validation is required before final submission package handoff. |

## Permission Justification Draft (for Privacy Tab)

- `sidePanel`: Open persistent reader UI in Chrome side panel.
- `contextMenus`: Add right-click actions for selected text and full-page ingest.
- `storage`: Persist local reading/auth state and pending document handoff.
- `identity`: Support extension auth flow via `chrome.identity.launchWebAuthFlow`.
- `activeTab`: Grant temporary host access only after explicit user actions.
- `scripting`: Run on-demand text extraction in the active tab after user
  triggers, without persistent content script injection.

## Data Handling Disclosure Draft Inputs

From current extension behavior:

- Collected/stored locally: selected/page text for created documents, reading
  progress, auth state tokens in extension storage.
- Sent to backend when authenticated: document content and auth-backed sync data.
- User-facing declaration required in dashboard: data categories collected,
  purpose, and limited-use certification consistency with privacy policy URL.

## Pre-Submit Checklist

- [ ] Build and package commands pass on current commit.
- [ ] Load unpacked extension from `apps/extension/dist` and verify core flow.
- [ ] Store listing fields and media are completed and policy-compliant.
- [ ] Privacy fields are completed with accurate permission and data-use details.
- [ ] Public privacy policy URL is configured and consistent with actual behavior.
