import type { Classification, Conversation, RouteDecision } from "./domain.js";
import type { CategoryPolicy, LinkPolicy } from "./policy-schema.js";
import { hasManagerParticipation, hasOwnerParticipation, isTerminalAcknowledgment } from "./conversation-state.js";
import { appendFirstResponseFooter, missingFacts, renderTemplate } from "./templates.js";
import { olderThan } from "./time.js";

function categoryFor(policy: LinkPolicy, id: string): CategoryPolicy {
  const category = policy.categories.find((candidate) => candidate.enabled && candidate.id === id);
  if (!category) throw new Error(`Category ${id} is not enabled`);
  return category;
}

function outcomeFor(category: CategoryPolicy, fit: Classification["fit"]) {
  if (fit === "needs_information") return category.outcomes.needsInformation;
  if (fit === "aligned") return category.outcomes.aligned;
  if (fit === "misaligned") return category.outcomes.misaligned;
  if (fit === "uncertain") return category.outcomes.uncertain;
  return undefined;
}

export function route(conversation: Conversation, classification: Classification, policy: LinkPolicy): RouteDecision {
  if (hasOwnerParticipation(conversation)) {
    return {
      categoryId: classification.categoryId,
      actions: ["escalate", "mark_read"],
      autoSend: false,
      draft: null,
      escalationReason: "The owner has previously participated in this conversation.",
      permanentHandoff: true,
    };
  }
  if (hasManagerParticipation(conversation) && isTerminalAcknowledgment(conversation.latestInbound.text)) {
    return {
      categoryId: classification.categoryId,
      actions: ["mark_read"],
      autoSend: false,
      draft: null,
      escalationReason: null,
      permanentHandoff: false,
    };
  }
  const unknown = policy.categories.find((category) => category.enabled && category.id === "unknown");
  if (classification.confidence < policy.safety.minimumAutoActionConfidence || classification.promptInjectionDetected) {
    return {
      categoryId: unknown?.id ?? classification.categoryId,
      actions: ["escalate"],
      autoSend: false,
      draft: null,
      escalationReason: classification.promptInjectionDetected ? "Prompt injection or workflow manipulation detected." : "Classification confidence is below the configured threshold.",
      permanentHandoff: false,
    };
  }
  const category = categoryFor(policy, classification.categoryId);
  const inferredFit = category.requiredFacts.length && missingFacts(category.requiredFacts, classification.extractedFacts).length
    ? "needs_information"
    : classification.fit;
  const outcome = outcomeFor(category, inferredFit);
  const actions = outcome?.actions ?? category.actions;
  const template = outcome?.template ?? (hasManagerParticipation(conversation) ? category.followUpTemplate : category.firstResponseTemplate);
  const olderMessage = olderThan(conversation.latestInbound.timestamp, 30, policy.owner.timezone);
  let draft = actions.includes("reply") && template ? renderTemplate(template, policy, classification, category.requiredFacts, olderMessage) : null;
  if (draft && !hasManagerParticipation(conversation)) draft = appendFirstResponseFooter(draft, policy, category.label);
  return {
    categoryId: category.id,
    actions,
    autoSend: Boolean((outcome?.autoSend ?? category.autoSend) && actions.includes("reply")),
    draft,
    escalationReason: actions.includes("escalate") ? classification.rationale : null,
    permanentHandoff: outcome?.permanentHandoff ?? category.permanentHandoff,
  };
}
