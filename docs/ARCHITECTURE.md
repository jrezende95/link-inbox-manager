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

## Approval boundaries

Validation and historical preview cannot send. Live runtime requires both a local launch-approval record and explicit write flags. Historical cleanup additionally requires its own local approval record. These files are generated only after direct user approval and are ignored by Git.

## Extension boundary

The maintained core covers inbound LinkedIn triage. Contributors can propose optional modules, but campaigns, connection automation, posting, and general-purpose sender-directed tool use are outside the default runtime.
