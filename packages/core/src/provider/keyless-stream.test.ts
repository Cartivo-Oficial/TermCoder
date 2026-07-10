import { describe, expect, it } from "vitest";
import { repairToolCallStream } from "./keyless-stream";

function sse(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

async function drain(res: Response): Promise<string[]> {
  const text = await new Response(res.body).text();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

const delta = (calls: unknown) => `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: calls } }] })}`;

describe("repairToolCallStream", () => {
  it("remaps a continuation delta that lost its id onto the active tool call", async () => {
    const upstream = async () =>
      sse([
        delta([{ index: 0, id: "call_1", function: { name: "bash", arguments: "" } }]),
        delta([{ index: 0, function: { arguments: '{"command"' } }]),
        delta([{ index: 1, function: { arguments: ': "ls"}' } }]),
        "data: [DONE]",
      ]);

    const lines = await drain(await repairToolCallStream(upstream as unknown as typeof fetch)("https://x", {}));
    const last = JSON.parse(lines[2]!.slice(6));

    expect(last.choices[0].delta.tool_calls[0].index).toBe(0);
  });

  it("leaves a genuine second tool call alone", async () => {
    const upstream = async () =>
      sse([
        delta([{ index: 0, id: "call_1", function: { name: "read", arguments: "{}" } }]),
        delta([{ index: 1, id: "call_2", function: { name: "bash", arguments: "{}" } }]),
        delta([{ index: 1, function: { arguments: "" } }]),
        "data: [DONE]",
      ]);

    const lines = await drain(await repairToolCallStream(upstream as unknown as typeof fetch)("https://x", {}));

    expect(JSON.parse(lines[1]!.slice(6)).choices[0].delta.tool_calls[0].index).toBe(1);
    expect(JSON.parse(lines[2]!.slice(6)).choices[0].delta.tool_calls[0].index).toBe(1);
  });

  it("passes non-tool-call lines through byte for byte", async () => {
    const upstream = async () => sse(['data: {"choices":[{"delta":{"content":"hi"}}]}', "data: [DONE]"]);

    const lines = await drain(await repairToolCallStream(upstream as unknown as typeof fetch)("https://x", {}));

    expect(lines[0]).toBe('data: {"choices":[{"delta":{"content":"hi"}}]}');
    expect(lines[1]).toBe("data: [DONE]");
  });

  it("passes a body-less response through untouched", async () => {
    const upstream = async () => new Response(null, { status: 204 });

    const res = await repairToolCallStream(upstream as unknown as typeof fetch)("https://x", {});

    expect(res.status).toBe(204);
  });

  it("does not remap when no tool call has been announced yet", async () => {
    const upstream = async () => sse([delta([{ index: 2, function: { arguments: "x" } }]), "data: [DONE]"]);

    const lines = await drain(await repairToolCallStream(upstream as unknown as typeof fetch)("https://x", {}));

    expect(JSON.parse(lines[0]!.slice(6)).choices[0].delta.tool_calls[0].index).toBe(2);
  });

  it("strips a leaked harmony channel token from a tool name", async () => {
    const upstream = async () =>
      sse([
        delta([{ index: 0, id: "c1", function: { name: "bash<|channel|>commentary", arguments: "{}" } }]),
        "data: [DONE]",
      ]);

    const lines = await drain(await repairToolCallStream(upstream as unknown as typeof fetch)("https://x", {}));

    expect(JSON.parse(lines[0]!.slice(6)).choices[0].delta.tool_calls[0].function.name).toBe("bash");
  });

  it("leaves a clean tool name untouched", async () => {
    const upstream = async () =>
      sse([delta([{ index: 0, id: "c1", function: { name: "read", arguments: "{}" } }]), "data: [DONE]"]);

    const lines = await drain(await repairToolCallStream(upstream as unknown as typeof fetch)("https://x", {}));

    expect(JSON.parse(lines[0]!.slice(6)).choices[0].delta.tool_calls[0].function.name).toBe("read");
  });
});
