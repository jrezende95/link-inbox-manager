# Operator runbook

This runbook is for the user and the coding agent maintaining an installed Link instance.

## Normal checks

- `npm run status` shows the most recent run, pending actions, and owner-controlled conversation count.
- `npm run doctor` checks macOS, Node.js, Chrome, local policy, provider credentials, Sheets mode, and launch approval.
- Service output is under `~/Library/Logs/LinkInboxManager/`.

## Safe stop

Run `npm run service:uninstall`. This unloads the LaunchAgent but leaves the ignored policy, browser profile, ledger, OAuth token, and logs intact.

## Session expiration or account challenge

Link stops instead of automating recovery. Uninstall or leave the service stopped, run `npm run browser:login`, complete sign-in or the platform's verification manually, confirm Messaging loads, then restart only after inspecting the logs and current browser state.

Never add CAPTCHA solving, stealth behavior, fingerprint manipulation, or automated challenge handling.

## Duplicate or uncertain send

Stop the service. Inspect the actual LinkedIn thread and the local ledger before doing anything else. Do not blindly retry a send that could have succeeded but failed visual verification.

## Updating

1. Stop the service.
2. Back up `config/policy.local.json`, `.env.local`, `.link/`, and `data/` outside the repository.
3. Pull the reviewed release.
4. Run `npm ci` and `npm run verify`.
5. Review policy-schema changes with a coding agent; never overwrite private configuration.
6. Run a supervised validation batch before restoring live actions when classification or browser behavior changed.
7. Reinstall the service and inspect its first run.
