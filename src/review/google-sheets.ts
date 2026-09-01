import { google } from "googleapis";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AppConfig } from "../config.js";
import type { ReviewRecord } from "../domain.js";

const headers = [
  "Batch",
  "Conversation ID",
  "Conversation URL",
  "Sender",
  "Headline",
  "Received",
  "Inbound message",
  "Context",
  "Classification",
  "Confidence",
  "Rationale",
  "Proposed actions",
  "Proposed response",
  "Escalation",
  "Owner feedback"
] as const;

function auth(config: AppConfig) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = config.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  let refreshToken = GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    try {
      const saved = JSON.parse(readFileSync(resolve(config.env.LINK_GOOGLE_TOKEN_PATH), "utf8")) as { refresh_token?: unknown };
      if (typeof saved.refresh_token === "string") refreshToken = saved.refresh_token;
    } catch { /* Connector-assisted validation does not require local OAuth. */ }
  }
  if (!refreshToken) return null;
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function sheetsConfigured(config: AppConfig): boolean {
  return Boolean(auth(config) && config.env.LINK_GOOGLE_SHEET_ID);
}

export async function appendReviewRecords(config: AppConfig, records: ReviewRecord[]): Promise<void> {
  const client = auth(config);
  const spreadsheetId = config.env.LINK_GOOGLE_SHEET_ID;
  if (!client || !spreadsheetId || !records.length) return;
  const sheets = google.sheets({ version: "v4", auth: client });
  const tab = config.env.LINK_GOOGLE_SHEET_TAB.replaceAll("'", "''");
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A1:O1` });
  if (!existing.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A1:O1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...headers]] },
    });
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${tab}'!A:O`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: records.map((record) => [
        record.batchId,
        record.conversationId,
        record.conversationUrl,
        record.senderName,
        record.senderHeadline,
        record.receivedAt,
        record.inboundMessage,
        record.context,
        record.category,
        record.confidence,
        record.rationale,
        record.proposedActions,
        record.proposedResponse,
        record.escalation,
        record.ownerFeedback,
      ]),
    },
  });
}
