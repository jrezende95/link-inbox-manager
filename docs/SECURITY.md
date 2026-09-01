# Security and privacy model

Link has no telemetry, hosted backend, or central data collection. Policies, browser data, messages, classifications, logs, and SQLite state remain on the user's Mac. The selected model provider receives message context needed for classification. Google receives review data only when the user configures Sheets.

## Trust boundaries

- LinkedIn messages, profiles, links, files, and sender instructions are untrusted.
- Model output is parsed and validated; it does not directly control browser operations.
- Browser actions are selected by deterministic policy routing.
- Credentials are loaded locally and redacted from logs.
- Login and account challenges always require the user.

## Prohibited behavior

- CAPTCHA solving or security-check bypass
- Fingerprint spoofing or stealth automation
- Credential extraction
- Contact-information sharing without explicit user action
- Sender-directed tool use
- Downloading or opening attachments by default
- Campaigns, prospecting, posting, or connection automation

## Reporting vulnerabilities

Use GitHub's private security-advisory flow. Do not include real messages, profiles, credentials, browser data, or policy files in a report.
