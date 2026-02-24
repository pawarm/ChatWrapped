# macOS Code Signing and Notarization (Tauri)

This document describes how to set up macOS code signing and notarization for ChatWrapped Tauri releases.

## Prerequisites

1. **Apple Developer Program** membership ($99/year)
2. **Developer ID Application** certificate from Apple Developer portal
3. **App-specific password** for notarization

## GitHub Actions Secrets

Set these secrets in your GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate file |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` file |
| `APPLE_SIGNING_IDENTITY` | Certificate name, e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from [appleid.apple.com](https://appleid.apple.com) |
| `APPLE_TEAM_ID` | Your 10-character Apple Developer Team ID |

## Generating the Base64 Certificate

```bash
# Export your Developer ID Application certificate from Keychain Access as .p12
# Then encode it:
base64 -i Certificates.p12 | pbcopy
# Paste into the APPLE_CERTIFICATE GitHub secret
```

## Generating an App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com) → Security → App-Specific Passwords
2. Generate a new password for "ChatWrapped CI"
3. Store it in the `APPLE_APP_SPECIFIC_PASSWORD` secret

## How Tauri Handles Signing

Tauri uses the `tauri-apps/tauri-action` GitHub Action, which:

1. Signs the `.app` bundle with `codesign` using `APPLE_SIGNING_IDENTITY`
2. Creates a `.dmg` disk image
3. Submits to Apple's notarization service using `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID`
4. Staples the notarization ticket to the `.dmg`

The signing environment variables are set in the release workflow at `.github/workflows/release.yml`.

## Local Signing (Development)

For local builds, Tauri will use the signing identity from your macOS Keychain if available:

```bash
bun run tauri:build
```

To test notarization locally, set the environment variables before building:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="YOURTEAMID"
bun run tauri:build
```
