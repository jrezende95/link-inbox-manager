import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Conversation } from "../src/domain.js";
import { parsePolicy } from "../src/policy-schema.js";

export function examplePolicy() {
  return parsePolicy(JSON.parse(readFileSync(resolve("config/policy.example.json"), "utf8")));
}

export function conversation(text = "Would you consider a leadership role?"): Conversation {
  const latestInbound = { id: "message-1", senderName: "Alex Example", text, timestamp: "Today at 9:00 AM", fromOwner: false };
  return {
    id: "conversation-1",
    url: "https://www.linkedin.com/messaging/thread/example/",
    senderName: "Alex Example",
    senderHeadline: "Synthetic recruiter",
    unread: true,
    messages: [latestInbound],
    latestInbound,
  };
}
