import type { Classification } from "./domain.js";
import type { LinkPolicy } from "./policy-schema.js";

function clean(value: string): string {
  return value.replace(/\n{3,}/g, "\n\n").trim();
}

export function missingFacts(required: string[], facts: Classification["extractedFacts"]): string[] {
  return required.filter((fact) => {
    const value = facts[fact];
    return value === undefined || value === null || value === "";
  });
}

export function renderTemplate(template: string, policy: LinkPolicy, classification: Classification, requiredFacts: string[], olderMessage = false): string {
  const replacements: Record<string, string> = {
    manager_name: policy.manager.name,
    manager_intro: policy.manager.introduction.replace(/{{owner_name}}/g, policy.owner.displayName),
    manager_signature: policy.manager.signature,
    owner_name: policy.owner.displayName,
    professional_summary: policy.owner.professionalSummary,
    missing_facts: missingFacts(requiredFacts, classification.extractedFacts).join(", "),
    public_fit_reason: classification.publicFitReason ?? "the information provided",
    older_message_guidance: olderMessage ? policy.validation.olderMessageGuidance ?? "" : "",
  };
  let result = template;
  for (const [key, value] of Object.entries(replacements)) result = result.replaceAll(`{{${key}}}`, value);
  return clean(result);
}

export function appendFirstResponseFooter(draft: string, policy: LinkPolicy, categoryLabel: string): string {
  if (!policy.manager.includeClassificationFooter) return draft;
  return clean(`${draft}\n\nClassification: ${categoryLabel}\n${policy.manager.correctionInvitation}`);
}
