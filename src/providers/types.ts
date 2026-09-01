import type { ProviderName } from "../domain.js";

export interface StructuredModelRequest {
  system: string;
  input: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
}

export interface ModelProvider {
  readonly name: ProviderName;
  readonly model: string;
  generateStructured(request: StructuredModelRequest): Promise<unknown>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderName,
    readonly status?: number,
  ) {
    super(message);
  }
}

export async function parseJsonResponse(response: Response, provider: ProviderName): Promise<unknown> {
  const body = await response.text();
  if (!response.ok) {
    throw new ProviderError(`${provider} request failed with HTTP ${response.status}`, provider, response.status);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new ProviderError(`${provider} returned invalid JSON`, provider, response.status);
  }
}

export function parseModelJson(text: string, provider: ProviderName): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new ProviderError(`${provider} returned output that did not contain valid structured JSON`, provider);
  }
}
