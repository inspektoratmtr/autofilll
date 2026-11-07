# Mataram Autofill

Local-first Chrome Extension for form autofill and browser productivity automation.

## Requirements
- Node.js 20+
- pnpm 9+
- Google Chrome or Chromium-based browser

## Development
```bash
pnpm install
pnpm build
```

## Load in Chrome
1. Run `pnpm build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose **Load unpacked**.
5. Select the generated `dist/` folder.

## Current starter implementation
- Manifest V3
- Svelte 5 popup and options page
- Local storage with Zod validation
- Profiles data model
- Basic attribute-based autofill rules
- Safe and overwrite modes
- Keyboard shortcut and context menu
- JSON backup and restore

## Important limitations
This is the initial foundation, not yet a feature-complete Lightning Autofill replacement. JavaScript rules are intentionally not evaluated in this version. Macro recording/playback, text expansion, text clips, dynamic variables, XPath matching, infobar, side panel, rule generation, and IndexedDB-backed recovery are planned modules.

Never store passwords, authentication tokens, payment card data, or confidential government records in autofill rules. Chrome local storage is not encrypted.
# autofilll
# autofilll
