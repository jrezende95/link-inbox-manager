import { createHash } from "node:crypto";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright-core";
import type { AppConfig } from "./config.js";
import { assertWritesAllowed } from "./config.js";
import type { Conversation, Message } from "./domain.js";

const selectors = {
  conversationItem: "li.msg-conversations-container__convo-item, li.msg-conversation-listitem",
  messageEvent: ".msg-s-event-listitem, .msg-s-message-list__event",
  bubble: ".msg-s-event-listitem__message-bubble, .msg-s-event-listitem__body, .msg-s-message-group__message-bubble",
  sender: ".msg-s-message-group__name, .msg-s-message-group__profile-link",
  timestamp: "time, .msg-s-message-group__timestamp",
  composer: "div[contenteditable='true'][role='textbox']",
  sendButton: "button.msg-form__send-button",
} as const;

const challengePatterns = [
  /security verification/i,
  /quick security check/i,
  /verify your identity/i,
  /unusual activity/i,
  /account.*restricted/i,
  /captcha/i,
];

function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
function randomInt(min: number, max: number): number { return Math.floor(min + Math.random() * (max - min + 1)); }
async function pause(min: number, max: number): Promise<void> { await sleep(randomInt(min, max)); }

export class SafetyStop extends Error {}

export function managerSignatureDetected(text: string, managerName: string, signature: string): boolean {
  const escapedName = managerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.includes(signature) || new RegExp(`(?:I['’]?m|I am)\\s+${escapedName}\\b`, "i").test(text);
}

export function messageAuthorship(text: string, sender: string, classes: string, ownerName: string, managerName: string, signature: string): { fromOwner: boolean; fromManager: boolean } {
  const escapedOwner = ownerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fromOwner = new RegExp(`^(?:${escapedOwner}|You)$`, "i").test(sender) || /outbound|from-me|self/i.test(classes);
  return { fromOwner, fromManager: fromOwner && managerSignatureDetected(text, managerName, signature) };
}

function uniqueBubbleText(values: string[]): string {
  const seen = new Map<string, string>();
  for (const raw of values) {
    const text = raw.trim();
    const key = text.replace(/\s+/g, " ");
    if (key && !seen.has(key)) seen.set(key, text);
  }
  return [...seen.values()].join("\n");
}

export class LinkedInClient {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private lastSendAt = 0;

  constructor(private readonly config: AppConfig) {}

  async start(): Promise<void> {
    this.context = await chromium.launchPersistentContext(this.config.paths.browserProfile, {
      executablePath: this.config.env.LINK_CHROME_EXECUTABLE,
      headless: false,
      viewport: { width: 1360, height: 900 },
    });
    this.page = this.context.pages()[0] ?? await this.context.newPage();
  }

  async openLogin(): Promise<void> {
    const page = this.requirePage();
    await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  }

  async collect(limit: number): Promise<Conversation[]> {
    const page = this.requirePage();
    const byCategory: Record<"Focused" | "Other", Array<{ url: string; unread: boolean }>> = { Focused: [], Other: [] };
    for (const category of ["Focused", "Other"] as const) {
      await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
      await pause(1800, 4200);
      await this.assertSafePage();
      await this.selectInboxCategory(page, category);
      await this.loadConversationRows(page, limit);
      const items = page.locator(selectors.conversationItem);
      const seen = new Set<string>();
      for (let index = 0; index < await items.count() && byCategory[category].length < limit; index += 1) {
        const item = items.nth(index);
        const link = item.locator("a[href*='/messaging/thread/']").first();
        const href = await link.getAttribute("href");
        if (!href) continue;
        const url = new URL(href, "https://www.linkedin.com").toString();
        if (seen.has(url)) continue;
        seen.add(url);
        const unread = /unread/i.test(await item.getAttribute("class") ?? "") || await item.locator(".notification-badge, [aria-label*='unread' i]").count() > 0;
        byCategory[category].push({ url, unread });
      }
    }

    const targets = new Map<string, { url: string; unread: boolean }>();
    for (let index = 0; targets.size < limit; index += 1) {
      let added = false;
      for (const category of ["Focused", "Other"] as const) {
        const target = byCategory[category][index];
        if (!target) continue;
        const existing = targets.get(target.url);
        targets.set(target.url, existing ? { ...existing, unread: existing.unread || target.unread } : target);
        added = true;
        if (targets.size >= limit) break;
      }
      if (!added) break;
    }

    const conversations: Conversation[] = [];
    for (const target of targets.values()) {
      const conversation = await this.readConversation(target.url, target.unread);
      if (conversation) conversations.push(conversation);
      if (conversations.length >= limit) break;
    }
    return conversations;
  }

  async readConversation(url: string, unread = false): Promise<Conversation | null> {
    const page = this.requirePage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await pause(1600, 3600);
    await this.assertSafePage();
    const id = decodeURIComponent(page.url()).match(/\/messaging\/thread\/([^/?#]+)/)?.[1] ?? page.url();
    return this.extractConversation(page, id, page.url(), unread);
  }

  async sendReply(conversation: Conversation, draft: string): Promise<void> {
    assertWritesAllowed(this.config);
    const elapsed = Date.now() - this.lastSendAt;
    const gap = randomInt(this.config.policy.safety.minimumDelaySeconds * 1000, this.config.policy.safety.maximumDelaySeconds * 1000);
    if (this.lastSendAt && elapsed < gap) await sleep(gap - elapsed);

    const refreshed = await this.readConversation(conversation.url, conversation.unread);
    if (!refreshed || refreshed.latestInbound.id !== conversation.latestInbound.id) {
      throw new SafetyStop("Conversation changed after classification; duplicate or stale send blocked.");
    }
    if (refreshed.messages.at(-1)?.fromOwner) throw new SafetyStop("Latest message is already outbound; duplicate send blocked.");
    const page = this.requirePage();
    const composer = page.locator(selectors.composer).last();
    const send = page.locator(selectors.sendButton).last();
    if (await composer.count() !== 1 || await send.count() !== 1) throw new SafetyStop("Message composer is missing or ambiguous.");
    await composer.fill(draft);
    await pause(2200, 5200);
    if (!await send.isEnabled()) throw new SafetyStop("Send button is unexpectedly disabled.");
    await send.click();
    await this.declineContactSharing(page);
    this.lastSendAt = Date.now();
    await this.verifyLatestOutbound(page, draft);
  }

  async markRead(conversation: Conversation): Promise<boolean> {
    if (!this.config.env.LINK_AUTO_MARK_READ) return false;
    await this.readConversation(conversation.url, conversation.unread);
    return true;
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.page = null;
  }

  private requirePage(): Page {
    if (!this.page) throw new Error("LinkedIn browser is not started");
    return this.page;
  }

  private async assertSafePage(): Promise<void> {
    const page = this.requirePage();
    const url = page.url();
    if (/\/login|checkpoint|challenge/i.test(url)) throw new SafetyStop("LinkedIn requires sign-in or account verification.");
    const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 20_000);
    if (challengePatterns.some((pattern) => pattern.test(text))) throw new SafetyStop("LinkedIn displayed an account safety challenge or warning.");
  }

  private async selectInboxCategory(page: Page, category: "Focused" | "Other"): Promise<void> {
    const button = page.getByRole("button", { name: new RegExp(`^${category}$`, "i") }).first();
    if (await button.count()) {
      await button.click();
      await pause(1200, 2400);
    } else if (category === "Other") {
      return;
    }
  }

  private async loadConversationRows(page: Page, limit: number): Promise<void> {
    for (let attempts = 0; attempts < 12; attempts += 1) {
      const count = await page.locator(selectors.conversationItem).count();
      if (count >= limit) return;
      const loadMore = page.getByRole("button", { name: /load more conversations/i });
      if (!await loadMore.count() || !await loadMore.isVisible()) return;
      await loadMore.click();
      await pause(1200, 2600);
    }
  }

  private async extractConversation(page: Page, id: string, url: string, unread: boolean): Promise<Conversation | null> {
    const heading = page.locator("main h2").filter({ hasNotText: /conversation list/i }).first();
    const senderName = (await heading.textContent().catch(() => null))?.trim() || "Unknown sender";
    const senderHeadline = (await heading.locator("xpath=following::*[1]").textContent().catch(() => null))?.trim();
    const events = page.locator(selectors.messageEvent);
    const messages: Message[] = [];
    for (let index = 0; index < await events.count(); index += 1) {
      const event = events.nth(index);
      const text = uniqueBubbleText(await event.locator(selectors.bubble).allInnerTexts());
      if (!text) continue;
      const sender = (await event.locator(selectors.sender).first().textContent().catch(() => null))?.trim() || senderName;
      const classes = await event.getAttribute("class") ?? "";
      const { fromOwner, fromManager } = messageAuthorship(
        text,
        sender,
        classes,
        this.config.policy.owner.displayName,
        this.config.policy.manager.name,
        this.config.policy.manager.signature,
      );
      const timestamp = (await event.locator(selectors.timestamp).last().textContent().catch(() => null))?.trim() || undefined;
      const explicitId = await event.getAttribute("data-event-urn") ?? await event.getAttribute("id");
      const messageId = explicitId || createHash("sha256").update(`${id}:${index}:${text}`).digest("hex").slice(0, 24);
      messages.push({ id: messageId, senderName: sender, text, timestamp, fromOwner, fromManager });
    }
    const latestInbound = [...messages].reverse().find((message) => !message.fromOwner);
    if (!latestInbound) return null;
    const resolvedSenderName = latestInbound.senderName || senderName;
    return { id, url, senderName: resolvedSenderName, senderHeadline, unread, messages, latestInbound };
  }

  private async declineContactSharing(page: Page): Promise<void> {
    const dialog = page.getByRole("dialog", { name: /share your contact info/i });
    try { await dialog.waitFor({ state: "visible", timeout: 4_000 }); }
    catch { return; }
    if (!this.config.policy.safety.declineContactSharing) throw new SafetyStop("LinkedIn requested contact sharing; policy requires a human decision.");
    const decline = dialog.getByRole("button", { name: /^No,\s*(?:don['’]t|do not) share$/i });
    if (await decline.count() !== 1) throw new SafetyStop("Contact-sharing decline control is missing or ambiguous.");
    await decline.click();
    await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  }

  private async verifyLatestOutbound(page: Page, draft: string): Promise<void> {
    const expected = draft.replace(/\s+/g, " ").trim();
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const latest = page.locator(selectors.messageEvent).last();
      const text = uniqueBubbleText(await latest.locator(selectors.bubble).allInnerTexts()).replace(/\s+/g, " ").trim();
      if (text === expected) return;
      await sleep(750);
    }
    throw new SafetyStop("Send was not visibly verified; further sends stopped.");
  }
}
