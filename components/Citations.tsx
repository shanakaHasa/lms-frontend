import type { Citation } from "@/lib/types";

/**
 * The citation list is the product, not decoration: a clinician has to be able
 * to check the source before acting on the answer. Showing which retriever
 * found each passage also makes retrieval debugging a UI feature rather than a
 * log-diving exercise.
 */
export default function Citations({ citations }: { citations: Citation[] }) {
  return (
    <details className="citations" open>
      <summary>{citations.length} source{citations.length === 1 ? "" : "s"}</summary>
      <ol>
        {citations.map((c) => (
          <li key={c.chunk_id} id={`citation-${c.index}`}>
            <span className="citations__file">{c.filename}</span>
            {c.page_from !== null && <span className="citations__page">p.{c.page_from}</span>}
            {c.section && <span className="citations__section">{c.section}</span>}
            <span className="citations__by">{c.retrieved_by.join(" + ")}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
