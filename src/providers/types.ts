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

// A classification is small. Bound provider JSON before parsing or schema validation.
export const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;

export async function parseJsonResponse(response: Response, provider: ProviderName): Promise<unknown> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new ProviderError(`${provider} request failed with HTTP ${response.status}`, provider, response.status);
  }
  if (Number(response.headers.get("content-length")) > MAX_PROVIDER_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new ProviderError(`${provider} response exceeded the size limit`, provider);
  }
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_PROVIDER_RESPONSE_BYTES) {
          await reader.cancel();
          throw new ProviderError(`${provider} response exceeded the size limit`, provider);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  try {
    return JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"));
  } catch {
    throw new ProviderError(`${provider} returned invalid JSON`, provider, response.status);
  }
}

export function parseModelJson(text: string, provider: ProviderName): unknown {
  if (Buffer.byteLength(text, "utf8") > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new ProviderError(`${provider} output exceeded the size limit`, provider);
  }
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new ProviderError(`${provider} returned output that did not contain valid structured JSON`, provider);
  }
}
