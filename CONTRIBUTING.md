# Contributing

Thank you for helping improve Link Inbox Manager.

## Scope

The supported core is inbound LinkedIn inbox triage on macOS. Proposals for posting, prospecting, campaigns, connection automation, or unrelated assistant behavior should be designed as separate optional components and discussed before implementation.

## Privacy rule

Never submit real:

- LinkedIn messages or conversation exports
- Names, email addresses, phone numbers, profile URLs, or screenshots
- Personal policy files or thresholds
- API keys, OAuth credentials, cookies, browser profiles, databases, logs, or generated artifacts

Use synthetic identities and `example.com` addresses only. If a bug cannot be reproduced without private data, describe the behavior abstractly or use GitHub's private security-advisory flow.

## Pull requests

1. Open an issue or Discussion for substantial changes.
2. Fork and create a focused branch.
3. Add synthetic tests.
4. Run `npm run verify`.
5. Explain security, privacy, migration, and browser-safety implications.
6. Submit a pull request.

All pull requests require passing CI and maintainer review. The maintainer retains final merge authority. Avoid broad refactors mixed with behavioral changes.

## Browser safety

Do not add CAPTCHA bypasses, stealth plugins, fingerprint manipulation, rapid-fire activity, parallel sends, or optimistic send accounting. Every send must be re-read and verified. Unexpected UI must fail closed.

## Provider adapters

Use official provider documentation, strict structured output when available, local schema validation, redacted errors, and mocked contract tests. Never add live API keys or provider calls to CI.
