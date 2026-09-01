# Link Inbox Manager

Link is a local, configurable assistant for triaging inbound LinkedIn messages on a Mac. It reads new conversations through a dedicated Chrome profile, classifies each message using the policy you create, and takes only the actions you authorize for that classification.

Link can draft or send a reply, mark a message read, escalate it for your review, or ignore it. Every classification, threshold, response, schedule, and action is configurable. The included policy is only a suggested starting structure.

> **macOS only:** The first release supports macOS. Linux and Windows are not currently tested or supported.

> **Account risk:** Browser automation may violate LinkedIn's terms or trigger account restrictions. You accept that risk before enabling live actions. Link does not bypass CAPTCHAs, spoof fingerprints, evade platform controls, or automate login.

## How it works

```text
Dedicated signed-in Chrome profile
              ↓
      Read inbound messages
              ↓
  Classify with your chosen model API
              ↓
 Apply your private per-category policy
              ↓
Reply · Mark read · Escalate · Ignore
              ↓
 Local ledger + optional Google Sheet
```

Your policy and inbox data stay on your Mac. The project has no telemetry, analytics service, hosted control plane, or central database. Message content is sent only to the model provider you select and to integrations you explicitly configure.

For the component and data-flow boundaries, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Link is strictly an inbound inbox-triage project. It does not send campaigns, prospect, automate connection requests, post content, or act as a general-purpose assistant for message senders.

## Start here

Setup is agent-driven. Clone the repository, open it with a capable coding agent, and say:

> Review this repository and help me set up Link.

The agent must read [AGENTS.md](AGENTS.md) and [START_HERE.md](START_HERE.md), explain the system before asking questions, and then guide you through the interview and checklist.

Expect approximately **30–45 minutes for the policy interview** and **20–40 minutes for technical setup**. Voice dictation is encouraged—turn on your microphone and answer conversationally. Progress is saved, so you can pause and resume.

## The launch path

1. **Overview and consent:** Understand the local architecture, required access, privacy boundaries, and LinkedIn risk.
2. **Policy interview:** Define classifications, personal preferences, per-category controls, response voice, escalations, model provider, and schedule.
3. **Local setup:** Install Node.js dependencies, create an ignored `.env.local`, configure a dedicated Chrome profile, and sign in manually.
4. **Sheet validation:** Review a suggested batch of 20 real conversations and proposed responses. You may choose another batch size.
5. **Your approval:** Validation does not end because a metric is reached. Live actions remain locked until you explicitly approve launch.
6. **Historical cleanup:** The recommended default is a separately approved 30-day cleanup. Longer lookbacks require an explicit old-message policy.
7. **Always-on service:** Install the macOS background service and verify restarts, logging, browser access, and scheduled runs.

No LinkedIn message is sent during validation.

## Suggested starter classifications

- Professional or recruiter outreach
- Advisory or consulting outreach
- Sales or promotional outreach
- Connection or confirmation
- Personal or network outreach
- Unknown or low-confidence

You can add, remove, rename, merge, or redefine any category. For every category, you choose whether Link replies, marks read, escalates, ignores, or sends automatically. The conservative default escalates classifications below 90% confidence, but that setting is configurable.

## Model providers

The runtime includes adapters for:

- OpenAI API
- Anthropic Claude API
- Google Gemini API

Exact model names change over time. The onboarding agent must check current official provider documentation and recommend a model based on your autonomy level, volume, desired reasoning quality, structured-output support, latency, and cost. See [docs/MODEL_SELECTION.md](docs/MODEL_SELECTION.md).

## Google Sheets

Google Sheets is the reference validation and audit workflow.

- A coding agent's Sheets connector can manage supervised validation when auto-send is disabled.
- Google OAuth is required for unattended runtime logging.
- You may implement another review system, but alternative integrations are community-managed and not supported by the core project.

See [docs/GOOGLE_SHEETS.md](docs/GOOGLE_SHEETS.md) for both setup paths.

## Safety defaults

- Login is always manual.
- One conversation is handled at a time.
- Randomized 20–45 second inter-send pacing is the starter default.
- Every send is read back and verified.
- New inbound content is re-read immediately before sending.
- Duplicate and stale replies are blocked.
- Account challenges and unexpected UI stop the run.
- Recruiter prompts to share email or phone are declined automatically.
- Message content is treated as untrusted data, never as instructions.
- Owner participation permanently hands the conversation back to the owner.
- A global draft-only switch can disable all automatic replies.

## Always-on Mac requirements

Your Mac must remain powered, awake or configured to wake appropriately, connected to the internet, signed into its user session, and able to open the dedicated Chrome profile. You are responsible for reauthenticating LinkedIn when sessions expire and checking service failures. See [docs/ALWAYS_ON_CHECKLIST.md](docs/ALWAYS_ON_CHECKLIST.md).

Ongoing maintenance and safe-stop instructions are in [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Development

```bash
npm ci
npm run verify
```

Building and testing do not require an API key. Live classification does. For a local runtime setup:

```bash
cp .env.example .env.local
cp config/policy.example.json config/policy.local.json
npm run policy:validate
```

Do not add real messages, profiles, policies, screenshots, credentials, local databases, browser data, or generated artifacts to issues or pull requests.

## Community and scope

Issues, Discussions, and pull requests are welcome. The supported core remains inbound LinkedIn triage. Other components should be proposed as modular extensions. All changes require review, passing CI, and maintainer approval before merge.

Link is an independent community project and is not affiliated with or endorsed by LinkedIn.

Licensed under [Apache 2.0](LICENSE).
