/**
 * The LMS API client.
 *
 * One rule runs through it: **the token is passed in, never read from storage.**
 * A module that reached into `localStorage` on its own would make the storage
 * decision in `auth.tsx` unenforceable — any call site could quietly persist a
 * token to make its own life easier.
 *
 * Errors are unwrapped into a typed shape rather than surfaced as raw text. The
 * server returns `{error: {code, message, field?}, request_id}`, and `field` is
 * what lets a form highlight the input that clashed instead of showing a banner
 * that says "conflict".
 */

import type { Course, Enrolment, Page, RosterEntry, Student } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly field?: string,
    readonly requestId?: string | null,
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiFailure(
      body?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      body?.error?.code ?? "unknown",
      body?.error?.field,
      body?.request_id,
    );
  }
  return body as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : "";
}

// ── Students ───────────────────────────────────────────────────────────────

export const students = {
  list: (token: string, opts: { q?: string; limit?: number; offset?: number } = {}) =>
    request<Page<Student>>(
      `/api/v1/students${query({ q: opts.q, limit: opts.limit ?? 25, offset: opts.offset ?? 0 })}`,
      token,
    ),

  create: (
    token: string,
    input: {
      student_number: string;
      first_name: string;
      last_name: string;
      email: string;
      year_level?: number | null;
    },
  ) =>
    request<Student>("/api/v1/students", token, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // Soft on the server: the row survives so enrolments still resolve to a
  // person, and the student number becomes reusable.
  remove: (token: string, id: string) =>
    request<void>(`/api/v1/students/${id}`, token, { method: "DELETE" }),
};

// ── Courses ────────────────────────────────────────────────────────────────

export const courses = {
  list: (token: string, opts: { q?: string; limit?: number } = {}) =>
    request<Page<Course>>(
      `/api/v1/courses${query({ q: opts.q, limit: opts.limit ?? 50 })}`,
      token,
    ),

  create: (
    token: string,
    input: { code: string; title: string; term?: string | null; credits?: number | null },
  ) =>
    request<Course>("/api/v1/courses", token, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  roster: (token: string, courseId: string) =>
    request<Page<RosterEntry>>(`/api/v1/courses/${courseId}/roster?limit=100`, token),
};

// ── Enrolments ─────────────────────────────────────────────────────────────

export const enrolments = {
  /**
   * Idempotent on the server: 201 for a new enrolment, 200 if one already
   * existed. Both are successes, so this does not distinguish them — a UI that
   * treated a repeat as an error would be wrong about what happened.
   */
  create: (token: string, studentId: string, courseId: string) =>
    request<Enrolment>("/api/v1/enrolments", token, {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, course_id: courseId }),
    }),

  /** Withdraws — the server keeps the row and changes its status. */
  withdraw: (token: string, enrolmentId: string) =>
    request<void>(`/api/v1/enrolments/${enrolmentId}`, token, { method: "DELETE" }),
};
