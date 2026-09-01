# Agent-led onboarding interview

The interview should feel like a structured conversation, not a form. Ask one focused question at a time, reflect the answer, and resolve contradictions before moving on.

Target duration: 30–45 minutes. Encourage voice dictation. Save progress after every section.

## 1. Goals and boundaries — 10%

Establish what the user wants to stop reviewing manually, what Link must never do, and which inbox outcomes matter. Confirm inbound-only scope.

## 2. Classifications — 25%

Start with the suggested taxonomy. Ask the user to add, remove, rename, merge, or redefine categories. Gather positive examples, negative examples, and precedence rules. A connection message must not override a more substantive intent unless the user explicitly chooses that behavior.

## 3. Per-classification controls — 40%

For each category, determine whether Link should reply, mark read, escalate, ignore, or combine actions. Ask whether replies are draft-only or eligible for auto-send after validation. Define permanent handoff behavior and treatment of later replies.

## 4. Preferences and thresholds — 55%

Gather private decision criteria, required information, exclusions, minimums, edge cases, and what can be explained publicly. Keep private values separate from sender-facing explanations. Ask for age-specific behavior if historical lookback exceeds 30 days.

## 5. Voice and identity — 68%

Choose inbox-manager name, introduction, signature, classification footer, correction invitation, tone, template rigidity, and permitted variation. Draft each category's first and follow-up responses.

## 6. Escalations and review — 78%

Define what requires human review, urgency handling, digest timing, review destination, and what happens when confidence is low. Recommend a global draft-only emergency switch.

## 7. Technical setup — 90%

Choose OpenAI, Anthropic, or Gemini; verify current models from official documentation; choose schedule; select Google Sheets connector or OAuth; configure local paths; establish dedicated Chrome profile; and review always-on Mac requirements.

## 8. Validation and launch — 100%

Choose validation batch size (default 20), create the Sheet, run supervised classifications, collect feedback, and iterate. Explain that only the user can approve launch. Separately confirm the historical cleanup window (default 30 days) and background-service installation.

## Completion record

The agent must leave no unresolved questions before requesting launch approval. Completion percentage is informational only; it never authorizes live actions.
