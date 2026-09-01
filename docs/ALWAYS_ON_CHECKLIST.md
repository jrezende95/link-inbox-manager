# Always-on Mac checklist

Complete this checklist before installing the background service.

- The Mac is running a supported macOS version and Node.js 22 or newer.
- The repository remains at a stable path; do not move or delete it while the service is installed.
- The user account remains signed in after restart.
- The Mac has reliable power and internet access.
- Sleep and wake settings allow scheduled processing when expected.
- Chrome is installed at the configured path.
- The dedicated Link Chrome profile is signed into LinkedIn.
- No other Chrome process is simultaneously locking the dedicated profile.
- API credentials are present in an ignored `.env.local` or an explicitly configured Keychain workflow.
- Google OAuth is configured if unattended Sheet logging is enabled.
- The private policy validates successfully.
- Validation is complete and the user has explicitly approved launch.
- `npm run verify`, `npm run doctor`, and a supervised `npm run run:once` succeed.
- `npm run service:install` has been explicitly approved by the user.
- Service logs under `~/Library/Logs/LinkInboxManager` are readable.
- A restart test confirms the service returns automatically.
- The user knows how to run `npm run status` and `npm run service:uninstall`.
- The user will reauthenticate LinkedIn manually when the session expires.
- The user will review account warnings and service failures rather than attempting automated bypass.

Recommended maintenance:

- Check service status weekly during the first month.
- Review model/provider changes before updating exact model names.
- Pull repository updates manually and migrate policy only with a backup and confirmation.
- Keep macOS, Chrome, Node.js, and dependencies patched.
