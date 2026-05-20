# Code Signing & Notarization

Production desktop apps need signatures so the OS won't flag them as
"from an unidentified developer". Bunlet wires the tools — `codesign`
+ `notarytool` on macOS, `signtool` on Windows, `gpg --detach-sign` on
Linux — but credentials are yours to supply.

## macOS — codesign

The packager's `signDarwinApp()` step calls `codesign --deep --sign
"$identity"` with optional `--options runtime` and `--entitlements`.

Required: an Apple Developer ID Application certificate installed in
your login keychain. Find its identity with:

```bash
security find-identity -v -p codesigning
```

Pass the identity to the packager via `signOptions.identity` or set it
in your bunlet config. The default packager run does not sign — you have
to opt in.

## macOS — notarization

After signing, Apple still requires notarization for Gatekeeper to
trust the artifact on first run. Use `notarizeDarwinApp()` (exported
from `@bunlet/cli`) — it wraps `xcrun notarytool submit … --wait` and
runs `xcrun stapler staple` on success.

Credentials (read from options first, then env vars):

| Argument                  | Env var                       | Source |
|---------------------------|-------------------------------|--------|
| `appleId`                 | `APPLE_ID`                    | Apple Developer account email |
| `teamId`                  | `APPLE_TEAM_ID`               | https://developer.apple.com/account → Membership |
| `appSpecificPassword`     | `APPLE_APP_SPECIFIC_PASSWORD` | https://appleid.apple.com → Sign-In and Security → App-Specific Passwords |

App-specific passwords are required because Apple ID 2FA blocks regular
passwords for automation. Generate one labelled e.g. "bunlet notarize".

Minimum reproducible run:

```bash
APPLE_ID="you@example.com" \
APPLE_TEAM_ID="ABCDEFGHIJ" \
APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop" \
bun -e "
  import { notarizeDarwinApp } from '@bunlet/cli';
  await notarizeDarwinApp('release/MyApp-1.0.0.dmg');
"
```

The wrapper throws a structured error listing each missing credential by
name — it never silently skips notarization.

CI: do not check credentials into the repo. Inject them as GitHub
Actions secrets (`APPLE_*`) and pass through to the notarize step only
on release tag pushes. We do not run notarization in this repo's CI
because the project does not have an Apple Developer account.

## Windows — signtool

The packager's `signExe()` wraps `signtool sign /f <cert.pfx> /p
<password> /tr <timestamp-server>`. You need an Authenticode code
signing certificate (`.pfx`) and a timestamp server URL (use
`http://timestamp.digicert.com` for DigiCert-issued certs).

Pass via `signOptions`:

- `certificateFile`: path to the `.pfx`
- `certificatePassword`: password to unlock it
- `timestampServer`: timestamp URL

EV (Extended Validation) certificates avoid Microsoft SmartScreen warmup
delays for new apps but require a hardware token; the packager handles
both because `signtool` itself does.

## Linux — gpg detached signatures

AppImage is the recommended distribution format; it carries no
signature on its own but expects a sidecar `.AppImage.sig`. Use
`signAppImage()`:

```bash
bun -e "
  import { signAppImage } from '@bunlet/cli';
  signAppImage('release/MyApp-1.0.0.AppImage', { gpgKeyId: 'ABC123DEF456' });
"
```

Produces `release/MyApp-1.0.0.AppImage.sig`. Distribute both. Verifiers
run:

```bash
gpg --verify MyApp.AppImage.sig MyApp.AppImage
```

Required: a GPG key in your keyring. `gpg --list-secret-keys --keyid-format=long`
gives the id. If `gpg-agent` doesn't already cache the passphrase, pass
`passphrase` in the options (loopback pinentry).

## What's NOT done in v1.0

- Automated notarization run in CI (needs Apple Developer account).
- `.deb` package signing via `dpkg-sig`.
- Microsoft Store / WinGet bundle signing.
- Sparkle/Squirrel-style update signature verification (the auto-updater
  verifies SHA-512 against the manifest, but does not yet check a
  digital signature on the manifest itself).

These are tracked for v1.1.
