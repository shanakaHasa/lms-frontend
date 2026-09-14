/**
 * Shapes the LMS API actually returns.
 *
 * Hand-written rather than generated, because they are small and the generator
 * would be one more thing to run. The risk that creates is drift, so these
 * mirror the Pydantic models exactly — including the fields deliberately
 * *absent* from responses: `tenant_id` is never returned (it is a server-side
 * fact) and `email_normalized` is never returned (it is an index detail, and
 * exposing both invites a client to key off the wrong one).
 */

export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type Student = {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  year_level: number | null;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type StudentSummary = {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
};

export type Course = {
  id: string;
  code: string;
  title: string;
  term: string | null;
  status: string;
  description: string;
  teacher_user_id: string | null;
  credits: number | null;
  created_at: string;
  updated_at: string;
};

export type RosterEntry = {
  enrolment_id: string;
  status: string;
  grade: string | null;
  enrolled_at: string;
  student: StudentSummary;
};

export type Enrolment = {
  id: string;
  student_id: string;
  course_id: string;
  status: string;
  grade: string | null;
  enrolled_at: string;
  created_at: string;
  updated_at: string;
};

/** The error envelope every failure uses. `request_id` ties a screenshot to a log line. */
export type ApiError = {
  error: { code: string; message: string; field?: string; constraint?: string };
  request_id: string | null;
};
