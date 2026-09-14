export type Citation = {
  index: number;
  chunk_id: string;
  document_id: string;
  filename: string;
  page_from: number | null;
  page_to: number | null;
  section: string | null;
  score: number;
  retrieved_by: string[];
};

export type ReviewFlag = {
  reason: string;
  severity: "info" | "attention" | "urgent";
  citation_indices: number[];
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cost_usd: number;
};

/** One event from the backend's SSE stream. `type` mirrors the `event:` field. */
export type StreamEvent =
  | { type: "conversation"; conversation_id: string }
  | { type: "text"; text: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_end"; name: string; ok: boolean }
  | { type: "citations"; citations: Citation[] }
  | {
      type: "done";
      citations: Citation[];
      review_flags: ReviewFlag[];
      usage: Usage;
      turns: number;
      latency_ms: number;
      trace_id: string | null;
      prompt_version: string;
    }
  | { type: "error"; code: string; message: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations: Citation[];
  reviewFlags: ReviewFlag[];
  usage?: Usage;
  latencyMs?: number;
  streaming: boolean;
  error?: string;
};
