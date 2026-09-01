# Model selection

Link relies on reliable structured classification and conservative policy reasoning. Exact model names change, so the onboarding agent must verify current options from official provider documentation before recommending one.

Supported providers:

- [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)

## Capability tiers

### Autonomous tier

Use a provider's strong reasoning model with strict structured-output support. Required for configurations that automatically send messages or evaluate nuanced private rules.

### Supervised tier

Use a capable general model when every reply is reviewed before sending. Validation should still test ambiguous messages, prompt injection, category precedence, and private-rule protection.

### Unsupported tier

Do not use models that cannot reliably return the classification schema, distinguish message data from instructions, preserve private policy, or maintain category precedence.

## Evaluation criteria

- Classification accuracy on the user's real inbox
- Low-confidence calibration
- Structured-output reliability
- Prompt-injection resistance
- Private-rule non-disclosure
- Correct handling of changing conversation state
- Draft quality and consistency
- Latency and cost at expected volume

Model evaluation informs the user's decision but never automatically approves launch.
