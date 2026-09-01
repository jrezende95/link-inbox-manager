import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Classification, Conversation, ReviewRecord, RouteDecision } from "./domain.js";

export interface PendingAction {
  conversationId: string;
  messageId: string;
  senderName: string;
  conversationUrl: string;
  categoryId: string;
  draft: string | null;
  actions: string[];
  createdAt: string;
}

export class Ledger {
  private readonly db: Database.Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        control_state TEXT NOT NULL DEFAULT 'manager',
        last_seen_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS decisions (
        conversation_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        classification_json TEXT NOT NULL,
        decision_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(conversation_id, message_id)
      );
      CREATE TABLE IF NOT EXISTS pending_actions (
        conversation_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        draft TEXT,
        actions_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(conversation_id, message_id)
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        message_id TEXT,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS review_records (
        conversation_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        exported_at TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY(conversation_id, message_id, batch_id)
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        processed_count INTEGER NOT NULL DEFAULT 0,
        error TEXT
      );
    `);
  }

  close(): void { this.db.close(); }

  upsertConversation(conversation: Conversation): void {
    this.db.prepare(`
      INSERT INTO conversations(id,url,sender_name,last_seen_at) VALUES(?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET url=excluded.url,sender_name=excluded.sender_name,last_seen_at=excluded.last_seen_at
    `).run(conversation.id, conversation.url, conversation.senderName, new Date().toISOString());
  }

  hasDecision(conversationId: string, messageId: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM decisions WHERE conversation_id=? AND message_id=?").get(conversationId, messageId));
  }

  isOwnerControlled(conversationId: string): boolean {
    const row = this.db.prepare("SELECT control_state FROM conversations WHERE id=?").get(conversationId) as { control_state?: string } | undefined;
    return row?.control_state === "owner";
  }

  recordDecision(conversation: Conversation, classification: Classification, decision: RouteDecision): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT OR IGNORE INTO decisions(conversation_id,message_id,classification_json,decision_json,created_at)
      VALUES(?,?,?,?,?)
    `).run(conversation.id, conversation.latestInbound.id, JSON.stringify(classification), JSON.stringify(decision), now);
    if (decision.permanentHandoff) {
      this.db.prepare("UPDATE conversations SET control_state='owner' WHERE id=?").run(conversation.id);
    }
  }

  queueAction(conversation: Conversation, decision: RouteDecision): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO pending_actions(conversation_id,message_id,category_id,draft,actions_json,status,created_at,updated_at)
      VALUES(?,?,?,?,?,'pending',?,?)
      ON CONFLICT(conversation_id,message_id) DO NOTHING
    `).run(conversation.id, conversation.latestInbound.id, decision.categoryId, decision.draft, JSON.stringify(decision.actions), now, now);
  }

  markActionComplete(conversationId: string, messageId: string, status: "sent" | "dismissed" | "escalated"): void {
    this.db.prepare("UPDATE pending_actions SET status=?,updated_at=? WHERE conversation_id=? AND message_id=?")
      .run(status, new Date().toISOString(), conversationId, messageId);
  }

  pendingActions(): PendingAction[] {
    const rows = this.db.prepare(`
      SELECT p.conversation_id,p.message_id,c.sender_name,c.url,p.category_id,p.draft,p.actions_json,p.created_at
      FROM pending_actions p JOIN conversations c ON c.id=p.conversation_id
      WHERE p.status='pending' ORDER BY p.created_at
    `).all() as Array<Record<string, string | null>>;
    return rows.map((row) => ({
      conversationId: row.conversation_id!,
      messageId: row.message_id!,
      senderName: row.sender_name!,
      conversationUrl: row.url!,
      categoryId: row.category_id!,
      draft: row.draft,
      actions: JSON.parse(row.actions_json!) as string[],
      createdAt: row.created_at!,
    }));
  }

  addReviewRecord(conversation: Conversation, record: ReviewRecord): void {
    this.db.prepare(`INSERT OR IGNORE INTO review_records(conversation_id,message_id,batch_id,record_json,created_at) VALUES(?,?,?,?,?)`)
      .run(conversation.id, conversation.latestInbound.id, record.batchId, JSON.stringify(record), new Date().toISOString());
  }

  markReviewExported(records: ReviewRecord[]): void {
    const statement = this.db.prepare("UPDATE review_records SET exported_at=? WHERE conversation_id=? AND batch_id=?");
    const now = new Date().toISOString();
    this.db.transaction(() => records.forEach((record) => statement.run(now, record.conversationId, record.batchId)))();
  }

  event(conversationId: string | null, messageId: string | null, eventType: string, payload: unknown = {}): void {
    this.db.prepare("INSERT INTO events(conversation_id,message_id,event_type,payload_json,created_at) VALUES(?,?,?,?,?)")
      .run(conversationId, messageId, eventType, JSON.stringify(payload), new Date().toISOString());
  }

  startRun(id: string): void {
    this.db.prepare("INSERT INTO runs(id,started_at,status) VALUES(?,?,'running')").run(id, new Date().toISOString());
  }

  finishRun(id: string, status: "complete" | "failed", count: number, error?: string): void {
    this.db.prepare("UPDATE runs SET completed_at=?,status=?,processed_count=?,error=? WHERE id=?")
      .run(new Date().toISOString(), status, count, error ?? null, id);
  }

  status(): unknown {
    return {
      lastRun: this.db.prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT 1").get() ?? null,
      pendingActions: Number((this.db.prepare("SELECT COUNT(*) AS count FROM pending_actions WHERE status='pending'").get() as { count: number }).count),
      ownerControlledConversations: Number((this.db.prepare("SELECT COUNT(*) AS count FROM conversations WHERE control_state='owner'").get() as { count: number }).count),
    };
  }
}
