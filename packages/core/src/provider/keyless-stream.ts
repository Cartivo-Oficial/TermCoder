interface ToolCallDelta {
  index?: number;
  id?: string | null;
  function?: { name?: string | null; arguments?: string };
}

interface ChunkShape {
  choices?: Array<{ delta?: { tool_calls?: ToolCallDelta[] } }>;
}

export function repairToolCallStream(base: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const response = await base(input as Parameters<typeof fetch>[0], init);
    if (!response.body) return response;

    let activeIndex: number | null = null;

    const repairLine = (line: string): string => {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) return line;

      let chunk: ChunkShape;
      try {
        chunk = JSON.parse(line.slice(6)) as ChunkShape;
      } catch {
        return line;
      }

      const calls = chunk.choices?.[0]?.delta?.tool_calls;
      if (!Array.isArray(calls)) return line;

      let changed = false;
      for (const call of calls) {
        const fn = call.function;
        if (fn && fn.name != null) {
          const clean = fn.name.replace(/<\|.*$/s, "").trim();
          if (clean !== fn.name) {
            fn.name = clean;
            changed = true;
          }
        }
        if (call.id != null || fn?.name != null) {
          if (call.index != null) activeIndex = call.index;
          continue;
        }
        if (activeIndex != null && call.index !== activeIndex) {
          call.index = activeIndex;
          changed = true;
        }
      }

      return changed ? `data: ${JSON.stringify(chunk)}` : line;
    };

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const reader = response.body.getReader();
    let buffer = "";

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer) controller.enqueue(encoder.encode(repairLine(buffer)));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          controller.enqueue(encoder.encode(`${repairLine(line)}\n`));
        }
      },
      cancel(reason) {
        void reader.cancel(reason);
      },
    });

    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}
