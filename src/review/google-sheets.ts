import { OAuth2Client } from "google-auth-library";
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
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function sheetsConfigured(config: AppConfig): boolean {
  return Boolean(auth(config) && config.env.LINK_GOOGLE_SHEET_ID);
}

interface SheetsRequest {
  url: string;
  method: "GET" | "PUT" | "POST";
  params?: Record<string, string>;
  data?: { values: unknown[][] };
  retry: false;
  timeout: number;
}

export type SheetsRequester = (request: SheetsRequest) => Promise<{ data: { values?: unknown[][] } }>;

export async function appendReviewRecords(config: AppConfig, records: ReviewRecord[], requester?: SheetsRequester): Promise<void> {
  const client = auth(config);
  const spreadsheetId = config.env.LINK_GOOGLE_SHEET_ID;
  if (!client || !spreadsheetId || !records.length) return;
  const request: SheetsRequester = requester ?? ((options) => client.request(options));
  const valuesUrl = (range: string) => `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const tab = config.env.LINK_GOOGLE_SHEET_TAB.replaceAll("'", "''");
  // Do not retry an append with an uncertain outcome: that could duplicate private review rows.
  const options = { retry: false, timeout: 30_000 } as const;
  const existing = await request({ ...options, method: "GET", url: valuesUrl(`'${tab}'!A1:O1`) });
  if (!existing.data.values?.length) {
    await request({
      ...options,
      method: "PUT",
      url: valuesUrl(`'${tab}'!A1:O1`),
      params: { valueInputOption: "RAW" },
      data: { values: [[...headers]] },
    });
  }
  await request({
    ...options,
    method: "POST",
    url: `${valuesUrl(`'${tab}'!A:O`)}:append`,
    params: { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" },
    data: {
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
