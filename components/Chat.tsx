"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/api";
import type { ChatMessage, Citation } from "@/lib/types";
import Citations from "./Citations";

const SUGGESTIONS = [
  "What are the management goals in Margaret Bell's GP management plan?",
  "What dose of metformin is she taking?",
  "Do the discharge summary and the management plan disagree on any medication?",
];

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cancel any in-flight stream when the component unmounts, so a navigation
  // away actually stops the generation instead of paying for it.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (question: string) => {
      if (!question.trim() || busy) return;

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          text: question,
          citations: [],
          reviewFlags: [],
          streaming: false,
        },
        {
          id: assistantId,
          role: "assistant",
          text: "",
          citations: [],
          reviewFlags: [],
          streaming: true,
        },
      ]);
      setInput("");
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

      try {
        for await (const event of streamChat(question, {
          conversationId: conversationId.current,
          signal: controller.signal,
        })) {
          switch (event.type) {
            case "conversation":
              conversationId.current = event.conversation_id;
              break;
            case "text":
              patch((m) => ({ ...m, text: m.text + event.text }));
              break;
            case "tool_start":
              setToolActivity(labelFor(event.name));
              break;
            case "tool_end":
              setToolActivity(null);
              break;
            case "citations":
              patch((m) => ({ ...m, citations: event.citations }));
              break;
            case "done":
              patch((m) => ({
                ...m,
                citations: event.citations,
                reviewFlags: event.review_flags,
                usage: event.usage,
                latencyMs: event.latency_ms,
                streaming: false,
              }));
              break;
            case "error":
              patch((m) => ({ ...m, streaming: false, error: event.message }));
              break;
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          patch((m) => ({
            ...m,
            streaming: false,
            error: (error as Error).message,
          }));
        }
      } finally {
        setBusy(false);
        setToolActivity(null);
        abortRef.current = null;
      }
    },
    [busy],
  );

  return (
    <section className="chat">
      <div className="chat__log" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat__empty">
            <p>Try one of these:</p>
            <ul>
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => send(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((message) => (
          <article key={message.id} className={`msg msg--${message.role}`}>
            <div className="msg__body">
              {renderWithCitations(message.text, message.citations)}
              {message.streaming && <span className="cursor" aria-hidden />}
            </div>

            {message.error && <p className="msg__error">{message.error}</p>}

            {message.reviewFlags.map((flag, i) => (
              <p key={i} className={`flag flag--${flag.severity}`}>
                <strong>Clinician review ({flag.severity}):</strong> {flag.reason}
              </p>
            ))}

            {message.citations.length > 0 && (
              <Citations citations={message.citations} />
            )}

            {message.usage && (
              <p className="msg__meta">
                {message.latencyMs} ms · ${message.usage.cost_usd.toFixed(4)} ·{" "}
                {message.usage.cache_read_tokens > 0
                  ? `${message.usage.cache_read_tokens} cached tokens`
                  : "cold cache"}
              </p>
            )}
          </article>
        ))}

        {toolActivity && <p className="chat__activity">{toolActivity}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        className="chat__form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a plan, referral or discharge summary…"
          aria-label="Your question"
          disabled={busy}
        />
        {busy ? (
          <button type="button" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()}>
            Ask
          </button>
        )}
      </form>
    </section>
  );
}

function labelFor(tool: string): string {
  switch (tool) {
    case "search_clinical_documents":
      return "Searching documents…";
    case "list_documents":
      return "Checking what's on file…";
    case "lookup_mbs_item":
      return "Looking up the MBS item…";
    case "flag_for_clinician_review":
      return "Flagging for clinician review…";
    default:
      return "Working…";
  }
}

/**
 * Turn "[2]" into a superscript that links to the citation list. Done on the
 * rendered string rather than by asking the model for markup: the model's job
 * is to cite correctly, not to emit HTML.
 */
function renderWithCitations(text: string, citations: Citation[]) {
  const valid = new Set(citations.map((c) => c.index));
  return text.split(/(\[\d{1,2}\])/g).map((part, i) => {
    const match = /^\[(\d{1,2})\]$/.exec(part);
    if (!match) return <span key={i}>{part}</span>;
    const index = Number(match[1]);
    if (!valid.has(index)) return <span key={i}>{part}</span>;
    return (
      <a key={i} href={`#citation-${index}`} className="cite">
        {index}
      </a>
    );
  });
}
