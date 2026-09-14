"use client";

import { ApiFailure } from "@/lib/api";

/**
 * Renders a failure the way the API describes it.
 *
 * `request_id` is shown on anything unexpected, because it is the one thing
 * that ties what a user saw to a line in the logs.
 */
export default function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;

  if (error instanceof ApiFailure) {
    return (
      <p className="error" role="alert">
        {error.message}
        {error.field ? <span className="muted"> ({error.field})</span> : null}
        {error.status >= 500 && error.requestId ? (
          <span className="muted"> · reference {error.requestId}</span>
        ) : null}
      </p>
    );
  }

  return (
    <p className="error" role="alert">
      {error instanceof Error ? error.message : "Something went wrong."}
    </p>
  );
}
