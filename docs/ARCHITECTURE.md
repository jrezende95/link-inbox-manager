# Architecture

Link separates probabilistic interpretation from deterministic action control.

```text
LinkedIn UI in a dedicated Chrome profile
                |
                v
        Conversation extractor
                |
                v
   Model adapter: classification only
                |
                v
      Validated classification schema
                |
                v
     Deterministic private-policy router
                |
       +--------+--------+----------+
       |        |        |          |
       v        v        v          v
     Reply   Mark read  Escalate   Ignore
       |        |        |          |
       +--------+--------+----------+
                |
                v
       Local SQLite audit ledger
                |
                v
   Optional Google Sheet review log
```

## Components

- `src/linkedin.ts` serially reads and verifies LinkedIn browser state. It fails closed on challenges, stale conversations, ambiguous controls, and unverified sends.
- `src/classifier.ts` gives untrusted conversation data to the configured model and requires a structured result.
- `src/providers/` contains provider-specific structured-output adapters. Provider output never selects browser tools directly.
- `src/router.ts` applies the user's private categories, confidence boundary, outcomes, templates, and escalation rules.
- `src/ledger.ts` deduplicates inbound message decisions, records actions, and preserves permanent owner handoffs.
- `src/orchestrator.ts` runs validation, historical preview, separately approved cleanup, and steady-state modes.
- `src/scheduler.ts` evaluates the private schedule in the owner's timezone.
- `scripts/install-service.ts` installs the local macOS LaunchAgent.

## Data boundaries

There is no Link cloud service. Policy, browser state, inbox extracts, logs, review artifacts, approvals, and the ledger stay in ignored local paths. The selected model provider receives the conversation context required for classification. Google receives review records only when the user enables Sheets.

## Keep the core small

Link has no vector database, embedding pipeline, memory service, or agent framework. Its persistent state is an ordinary local SQLite file for decisions, pending actions, send history, and permanent human handoffs. The optional Google Sheet is a human-readable review log, not a second agent memory. Keep the local ledger even when using Sheets: it provides transactional duplicate protection and survives restarts without relying on a remote spreadsheet.

Model adapters use Node's built-in HTTP client. Sheets uses Google's authentication library and three direct Sheets REST operations rather than the full Google APIs SDK. Schema validation is kept at the model/configuration boundary instead of replacing it with permissive parsing. Provider response bodies are limited to 256 KiB before JSON parsing or schema validation; oversized responses fail closed rather than being truncated into a potentially misleading classification.

Development uses Node's built-in test runner. Browser automation, local SQLite, timezone handling, credential loading, and redacted logging retain focused libraries; removing these safeguards solely to lower a package count would shift their complexity into application code.

## Approval boundaries

Validation and historical preview cannot send. Live runtime requires both a local launch-approval record and explicit write flags. Historical cleanup additionally requires its own local approval record. These files are generated only after direct user approval and are ignored by Git.

## Extension boundary

The maintained core covers inbound LinkedIn triage. Contributors can propose optional modules, but campaigns, connection automation, posting, and general-purpose sender-directed tool use are outside the default runtime.
