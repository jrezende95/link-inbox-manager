import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_PROVIDER_RESPONSE_BYTES, parseJsonResponse, parseModelJson, ProviderError } from "../src/providers/types.js";

describe("bounded provider output", () => {
  it("accepts normal and fenced model JSON", async () => {
    assert.deepEqual(await parseJsonResponse(new Response('{"ok":true}'), "openai"), { ok: true });
    assert.deepEqual(parseModelJson('```json\n{"ok":true}\n```', "gemini"), { ok: true });
  });

  it("rejects an oversized declared response without reading its body", async () => {
    const response = new Response("not read", { headers: { "content-length": String(MAX_PROVIDER_RESPONSE_BYTES + 1) } });
    await assert.rejects(parseJsonResponse(response, "openai"), /size limit/);
    assert.equal(response.bodyUsed, true);
  });

  it("counts streamed bytes without trusting a missing or false Content-Length", async () => {
    for (const contentLength of [undefined, "1"]) {
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) { controller.enqueue(new Uint8Array(64 * 1024)); },
        cancel() { cancelled = true; },
      });
      const response = new Response(body, { headers: contentLength ? { "content-length": contentLength } : {} });
      await assert.rejects(parseJsonResponse(response, "anthropic"), /size limit/);
      assert.equal(cancelled, true);
    }
  });

  it("decodes UTF-8 correctly across chunk boundaries", async () => {
    const encoded = new TextEncoder().encode('{"text":"✓"}');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of encoded) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    });
    assert.deepEqual(await parseJsonResponse(new Response(body), "gemini"), { text: "✓" });
  });

  it("redacts invalid JSON and HTTP error bodies", async () => {
    await assert.rejects(parseJsonResponse(new Response("private response"), "openai"), {
      message: "openai returned invalid JSON",
    });
    await assert.rejects(parseJsonResponse(new Response("private response", { status: 401 }), "openai"), {
      message: "openai request failed with HTTP 401",
      status: 401,
    });
  });

  it("bounds model text in bytes before parsing", () => {
    assert.throws(() => parseModelJson("✓".repeat(MAX_PROVIDER_RESPONSE_BYTES / 2), "gemini"), ProviderError);
  });
});
