import { ModelProvider, parseJsonResponse, parseModelJson, ProviderError, type StructuredModelRequest } from "./types.js";

export class OpenAIProvider implements ModelProvider {
  readonly name = "openai" as const;

  constructor(readonly model: string, private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {}

  async generateStructured(request: StructuredModelRequest): Promise<unknown> {
    const response = await this.fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        instructions: request.system,
        input: request.input,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: request.schemaName,
            strict: true,
            schema: request.jsonSchema,
          },
        },
      }),
    });
    const payload = await parseJsonResponse(response, this.name) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const text = payload.output_text ?? payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")?.text;
    if (!text) throw new ProviderError("OpenAI response did not contain output_text", this.name);
    return parseModelJson(text, this.name);
  }
}
