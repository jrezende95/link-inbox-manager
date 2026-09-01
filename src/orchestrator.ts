import type { Logger } from "pino";
import type { AppConfig } from "./config.js";
import { Classifier } from "./classifier.js";
import type { Conversation, ReviewRecord } from "./domain.js";
import { Ledger } from "./ledger.js";
import { LinkedInClient } from "./linkedin.js";
import { createProvider } from "./providers/factory.js";
import { appendReviewRecords, sheetsConfigured } from "./review/google-sheets.js";
import { writeReviewArtifact } from "./review/artifacts.js";
import { route } from "./router.js";
import { parseLinkedInTimestamp, withinLookback } from "./time.js";

function context(conversation: Conversation): string {
  return conversation.messages.slice(-10).map((message) => {
    const speaker = message.fromManager ? "Inbox manager" : message.fromOwner ? "Owner" : conversation.senderName;
    return `${speaker}: ${message.text}`;
  }).join("\n\n");
}

export class Orchestrator {
  private readonly ledger: Ledger;
  private readonly linkedin: LinkedInClient;
  private readonly classifier: Classifier;

  constructor(private readonly config: AppConfig, private readonly logger: Logger) {
    this.ledger = new Ledger(config.paths.database);
    this.linkedin = new LinkedInClient(config);
    this.classifier = new Classifier(createProvider(config), config.policy);
  }

  async run(options: { limit: number; mode: "validation" | "historical_preview" | "steady" | "historical"; launchApprovedAt?: string; lookbackDays?: number }): Promise<{ records: ReviewRecord[]; artifact: string }> {
    const runId = `run-${Date.now()}`;
    const batchId = `${options.mode}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    this.ledger.startRun(runId);
    const records: ReviewRecord[] = [];
    try {
      await this.linkedin.start();
      const conversations = await this.linkedin.collect(options.limit);
      for (const conversation of conversations) {
        if (!this.inScope(conversation, options)) continue;
        const record = await this.processConversation(conversation, batchId, options.mode === "validation" || options.mode === "historical_preview");
        if (record) records.push(record);
      }
      const artifact = await writeReviewArtifact(records, batchId);
      if (records.length && sheetsConfigured(this.config)) {
        await appendReviewRecords(this.config, records);
        this.ledger.markReviewExported(records);
      }
      this.ledger.finishRun(runId, "complete", records.length);
      return { records, artifact };
    } catch (error) {
      this.ledger.finishRun(runId, "failed", records.length, error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      await this.linkedin.close();
    }
  }

  private inScope(conversation: Conversation, options: { mode: "validation" | "historical_preview" | "steady" | "historical"; launchApprovedAt?: string; lookbackDays?: number }): boolean {
    if (options.mode === "validation") return true;
    if (options.mode === "historical" || options.mode === "historical_preview") {
      return withinLookback(
        conversation.latestInbound.timestamp,
        options.lookbackDays ?? this.config.policy.validation.historicalLookbackDays,
        this.config.policy.owner.timezone,
      );
    }
    const timestamp = parseLinkedInTimestamp(conversation.latestInbound.timestamp, this.config.policy.owner.timezone);
    if (!timestamp || !options.launchApprovedAt) return true;
    const approval = Date.parse(options.launchApprovedAt);
    return Number.isFinite(approval) && timestamp.toMillis() >= approval;
  }

  async processConversation(conversation: Conversation, batchId: string, validation: boolean): Promise<ReviewRecord | null> {
    this.ledger.upsertConversation(conversation);
    if (this.ledger.hasDecision(conversation.id, conversation.latestInbound.id)) return null;
    if (!validation && this.ledger.isOwnerControlled(conversation.id)) {
      this.ledger.event(conversation.id, conversation.latestInbound.id, "owner_controlled_message_seen", {});
      return null;
    }
    const classification = await this.classifier.classify(conversation);
    const decision = route(conversation, classification, this.config.policy);
    const category = this.config.policy.categories.find((candidate) => candidate.id === decision.categoryId);
    const record: ReviewRecord = {
      batchId,
      conversationId: conversation.id,
      conversationUrl: conversation.url,
      senderName: conversation.senderName,
      senderHeadline: conversation.senderHeadline ?? "",
      receivedAt: conversation.latestInbound.timestamp ?? "",
      inboundMessage: conversation.latestInbound.text,
      context: context(conversation),
      category: category?.label ?? decision.categoryId,
      confidence: classification.confidence,
      rationale: classification.rationale,
      proposedActions: decision.actions.join(", "),
      proposedResponse: decision.draft ?? "",
      escalation: decision.actions.includes("escalate") ? "Yes" : "No",
      ownerFeedback: "",
    };
    this.ledger.addReviewRecord(conversation, record);

    if (validation) return record;
    this.ledger.recordDecision(conversation, classification, decision);
    if (decision.actions.includes("reply") || decision.actions.includes("escalate")) this.ledger.queueAction(conversation, decision);
    if (decision.autoSend && this.config.env.LINK_AUTO_SEND && decision.draft) {
      await this.linkedin.sendReply(conversation, decision.draft);
      this.ledger.markActionComplete(conversation.id, conversation.latestInbound.id, "sent");
      this.ledger.event(conversation.id, conversation.latestInbound.id, "reply_sent", { categoryId: decision.categoryId });
    }
    if (decision.actions.includes("mark_read")) {
      const marked = await this.linkedin.markRead(conversation);
      if (marked) this.ledger.event(conversation.id, conversation.latestInbound.id, "marked_read", {});
    }
    if (decision.actions.includes("escalate")) this.ledger.event(conversation.id, conversation.latestInbound.id, "escalated", { reason: decision.escalationReason });
    this.logger.info({ conversationId: conversation.id, categoryId: decision.categoryId, actions: decision.actions }, "conversation processed");
    return record;
  }

  status(): unknown { return this.ledger.status(); }
  close(): void { this.ledger.close(); }
}
