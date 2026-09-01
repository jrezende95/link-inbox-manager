import { describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "../src/providers/openai.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { GeminiProvider } from "../src/providers/gemini.js";

const request = { system: "Classify synthetic input", input: "Hello", schemaName: "result", jsonSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false } };

describe("provider adapters", () => {
  it("uses OpenAI structured output without storing the response", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.store).toBe(false);
      expect(body.text.format.type).toBe("json_schema");
      return new Response(JSON.stringify({ output_text: "{\"ok\":true}" }), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(new OpenAIProvider("current-model", "test-key", fetcher).generateStructured(request)).resolves.toEqual({ ok: true });
  });

  it("uses Anthropic output_config structured output", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.output_config.format.type).toBe("json_schema");
      return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "{\"ok\":true}" }] }), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(new AnthropicProvider("current-model", "test-key", fetcher).generateStructured(request)).resolves.toEqual({ ok: true });
  });

  it("uses Gemini interactions structured output", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toContain("/v1beta/interactions");
      const body = JSON.parse(String(init?.body));
      expect(body.response_format.mime_type).toBe("application/json");
      return new Response(JSON.stringify({ output_text: "{\"ok\":true}" }), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(new GeminiProvider("current-model", "test-key", fetcher).generateStructured(request)).resolves.toEqual({ ok: true });
  });
});
