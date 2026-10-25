import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OpenAIProvider } from "../src/providers/openai.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { GeminiProvider } from "../src/providers/gemini.js";

const request = { system: "Classify synthetic input", input: "Hello", schemaName: "result", jsonSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false } };

describe("provider adapters", () => {
  it("uses OpenAI structured output without storing the response", async () => {
    const fetcher: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.store, false);
      assert.equal(body.text.format.type, "json_schema");
      return new Response(JSON.stringify({ output_text: "{\"ok\":true}" }), { status: 200 });
    };
    assert.deepEqual(await new OpenAIProvider("current-model", "test-key", fetcher).generateStructured(request), { ok: true });
  });

  it("uses Anthropic output_config structured output", async () => {
    const fetcher: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.output_config.format.type, "json_schema");
      return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "{\"ok\":true}" }] }), { status: 200 });
    };
    assert.deepEqual(await new AnthropicProvider("current-model", "test-key", fetcher).generateStructured(request), { ok: true });
  });

  it("uses Gemini interactions structured output", async () => {
    const fetcher: typeof fetch = async (url, init) => {
      assert.ok(String(url).includes("/v1beta/interactions"));
      const body = JSON.parse(String(init?.body));
      assert.equal(body.response_format.mime_type, "application/json");
      return new Response(JSON.stringify({ output_text: "{\"ok\":true}" }), { status: 200 });
    };
    assert.deepEqual(await new GeminiProvider("current-model", "test-key", fetcher).generateStructured(request), { ok: true });
  });
});
