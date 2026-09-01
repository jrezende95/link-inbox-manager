import type { Conversation } from "./domain.js";

export function hasOwnerParticipation(conversation: Conversation): boolean {
  return conversation.messages.some((message) => message.fromOwner && !message.fromManager);
}

export function hasManagerParticipation(conversation: Conversation): boolean {
  return conversation.messages.some((message) => message.fromManager);
}

export function isTerminalAcknowledgment(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.!]+$/, "");
  return /^(thanks|thank you|got it|understood|sounds good|okay|ok|great|appreciate it|will do)(\s+link)?$/.test(normalized);
}
