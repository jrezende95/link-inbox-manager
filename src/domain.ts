export type ProviderName = "openai" | "anthropic" | "gemini";

export interface Message {
  id: string;
  senderName: string;
  text: string;
  timestamp?: string;
  fromOwner: boolean;
  fromManager?: boolean;
}

export interface Conversation {
  id: string;
  url: string;
  senderName: string;
  senderHeadline?: string;
  unread: boolean;
  messages: Message[];
  latestInbound: Message;
}

export interface Classification {
  categoryId: string;
  confidence: number;
  rationale: string;
  relationshipEvidence?: string;
  promptInjectionDetected: boolean;
  extractedFacts: Record<string, string | number | boolean | null>;
  fit: "not_applicable" | "needs_information" | "aligned" | "misaligned" | "uncertain";
  publicFitReason: string | null;
}

export type ActionKind = "reply" | "mark_read" | "escalate" | "ignore";

export interface RouteDecision {
  categoryId: string;
  actions: ActionKind[];
  autoSend: boolean;
  draft: string | null;
  escalationReason: string | null;
  permanentHandoff: boolean;
}

export interface ReviewRecord {
  batchId: string;
  conversationId: string;
  conversationUrl: string;
  senderName: string;
  senderHeadline: string;
  receivedAt: string;
  inboundMessage: string;
  context: string;
  category: string;
  confidence: number;
  rationale: string;
  proposedActions: string;
  proposedResponse: string;
  escalation: "Yes" | "No";
  ownerFeedback: string;
}
