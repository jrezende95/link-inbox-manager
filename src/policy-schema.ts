import { z } from "zod";

const actionSchema = z.enum(["reply", "mark_read", "escalate", "ignore"]);

const outcomeSchema = z.object({
  actions: z.array(actionSchema).min(1),
  autoSend: z.boolean().default(false),
  permanentHandoff: z.boolean().default(false),
  template: z.string().nullable().default(null),
});

export const categorySchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  description: z.string().min(1),
  precedence: z.number().int().min(0),
  enabled: z.boolean().default(true),
  examples: z.array(z.string()).default([]),
  actions: z.array(actionSchema).min(1),
  autoSend: z.boolean().default(false),
  permanentHandoff: z.boolean().default(false),
  firstResponseTemplate: z.string().nullable().default(null),
  followUpTemplate: z.string().nullable().default(null),
  requiredFacts: z.array(z.string()).default([]),
  privateRules: z.array(z.string()).default([]),
  publicRejectionGuidance: z.string().nullable().default(null),
  outcomes: z.object({
    needsInformation: outcomeSchema.optional(),
    aligned: outcomeSchema.optional(),
    misaligned: outcomeSchema.optional(),
    uncertain: outcomeSchema.optional(),
  }).default({}),
});

export const policySchema = z.object({
  schemaVersion: z.literal(1),
  owner: z.object({
    displayName: z.string().min(1),
    timezone: z.string().min(1),
    professionalSummary: z.string().default(""),
    privateContext: z.array(z.string()).default([]),
  }),
  manager: z.object({
    name: z.string().min(1).default("Link"),
    introduction: z.string().min(1),
    signature: z.string().min(1),
    includeClassificationFooter: z.boolean().default(true),
    correctionInvitation: z.string().default("If I classified this incorrectly, please let me know—I’m still learning."),
  }),
  safety: z.object({
    minimumAutoActionConfidence: z.number().min(0).max(1).default(0.9),
    minimumDelaySeconds: z.number().int().min(5).default(20),
    maximumDelaySeconds: z.number().int().min(5).default(45),
    stopOnChallenge: z.boolean().default(true),
    declineContactSharing: z.boolean().default(true),
    ignoreMessageInstructions: z.boolean().default(true),
  }).refine((value) => value.maximumDelaySeconds >= value.minimumDelaySeconds, {
    message: "maximumDelaySeconds must be greater than or equal to minimumDelaySeconds",
  }),
  schedule: z.object({
    hours: z.array(z.number().int().min(0).max(23)).min(1),
    digestHour: z.number().int().min(0).max(23).nullable().default(null),
  }),
  validation: z.object({
    defaultBatchSize: z.number().int().min(1).default(20),
    historicalLookbackDays: z.number().int().min(0).default(30),
    olderMessageGuidance: z.string().nullable().default(null),
  }),
  escalation: z.object({
    digestEnabled: z.boolean().default(true),
    digestRecipient: z.string().email().nullable().default(null),
    immediateUrgencyWindowHours: z.number().int().min(0).default(0),
  }),
  categories: z.array(categorySchema).min(1),
}).superRefine((policy, context) => {
  const ids = new Set<string>();
  for (const category of policy.categories) {
    if (ids.has(category.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["categories"], message: `Duplicate category id: ${category.id}` });
    }
    ids.add(category.id);
  }
  if (policy.validation.historicalLookbackDays > 30 && !policy.validation.olderMessageGuidance) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["validation", "olderMessageGuidance"],
      message: "Lookbacks beyond 30 days require explicit older-message guidance",
    });
  }
});

export type LinkPolicy = z.infer<typeof policySchema>;
export type CategoryPolicy = z.infer<typeof categorySchema>;

export function parsePolicy(input: unknown): LinkPolicy {
  return policySchema.parse(input);
}
