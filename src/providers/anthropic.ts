import { ModelProvider, parseJsonResponse, parseModelJson, ProviderError, type StructuredModelRequest } from "./types.js";

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic" as const;

  constructor(readonly model: string, private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {}

  async generateStructured(request: StructuredModelRequest): Promise<unknown> {
    const response = await this.fetcher("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1400,
        system: request.system,
        messages: [{ role: "user", content: request.input }],
        output_config: {
          format: { type: "json_schema", schema: request.jsonSchema },
        },
      }),
    });
    const payload = await parseJsonResponse(response, this.name) as { content?: Array<{ type?: string; text?: string }>; stop_reason?: string };
    if (payload.stop_reason === "refusal" || payload.stop_reason === "max_tokens") {
      throw new ProviderError(`Anthropic structured output stopped with ${payload.stop_reason}`, this.name);
    }
    const text = payload.content?.find((item) => item.type === "text")?.text;
    if (!text) throw new ProviderError("Anthropic response did not contain text", this.name);
    return parseModelJson(text, this.name);
  }
}
