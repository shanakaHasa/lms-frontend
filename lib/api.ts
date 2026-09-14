import type { StreamEvent } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Stream a chat answer.
 *
 * EventSource is not used here even though this is SSE: EventSource only does
 * GET and cannot send an Authorization header. fetch + a manual SSE parse gives
 * us POST, bearer auth, and an AbortSignal that actually cancels the request --
 * which is what stops a token bill when the user navigates away.
 */
export async function* streamChat(
  question: string,
  options: {
    conversationId?: string | null;
    token?: string | null;
    signal?: AbortSignal;
  } = {},
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_URL}/api/v1/chat/stream`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: JSON.stringify({
      question,
      conversation_id: options.conversationId ?? null,
    }),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Chat request failed (${response.status}). ${detail}`.trim());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line. A partial frame stays in the
    // buffer until the rest of it arrives.
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseFrame(frame);
      if (parsed) yield parsed;
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function parseFrame(frame: string): StreamEvent | null {
  const dataLines: string[] = [];
  let eventName = "message";

  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue; // keep-alive ping
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;

  try {
    const payload = JSON.parse(dataLines.join("\n"));
    return { type: eventName, ...payload } as StreamEvent;
  } catch {
    return null;
  }
}

export async function searchDocuments(query: string, token?: string | null) {
  const response = await fetch(`${API_URL}/api/v1/chat/search`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Search failed (${response.status})`);
  return response.json();
}
