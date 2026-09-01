import { ModelProvider, parseJsonResponse, parseModelJson, ProviderError, type StructuredModelRequest } from "./types.js";

export class GeminiProvider implements ModelProvider {
  readonly name = "gemini" as const;

  constructor(readonly model: string, private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {}

  async generateStructured(request: StructuredModelRequest): Promise<unknown> {
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/interactions";
    const response = await this.fetcher(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        model: this.model,
        input: `${request.system}\n\nINPUT CONVERSATION:\n${request.input}`,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: request.jsonSchema,
        },
      }),
    });
    const payload = await parseJsonResponse(response, this.name) as {
      output_text?: string;
      steps?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const text = payload.output_text ?? payload.steps?.flatMap((step) => step.content ?? []).find((part) => part.type === "text")?.text;
    if (!text) throw new ProviderError("Gemini response did not contain text", this.name);
    return parseModelJson(text, this.name);
  }
}
