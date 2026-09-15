"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import ErrorNote from "@/components/ErrorNote";
import Shell from "@/components/Shell";
import { courses, enrolments, students } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Course, RosterEntry, Student } from "@/lib/types";

export default function CoursesPage() {
  const { session, can } = useAuth();
  const [rows, setRows] = useState<Course[]>([]);
  const [selected, setSelected] = useState<Course | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const token = session?.accessToken;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const page = await courses.list(token);
      setRows(page.items);
      setError(null);
    } catch (failure) {
      setError(failure);
    }
  }, [token]);

  const openRoster = useCallback(
    async (course: Course) => {
      if (!token) return;
      setSelected(course);
      try {
        const [entries, people] = await Promise.all([
          courses.roster(token, course.id),
          students.list(token, { limit: 100 }),
        ]);
        setRoster(entries.items);
        setAllStudents(people.items);
        setError(null);
      } catch (failure) {
        setError(failure);
      }
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    // See the note in app/students/page.tsx: `currentTarget` is null after the
    // first await, so the element is captured while the handler is still
    // synchronous.
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    setBusy(true);
    try {
      await courses.create(token, {
        code: String(form.get("code")),
        title: String(form.get("title")),
        term: (form.get("term") as string) || null,
        credits: form.get("credits") ? Number(form.get("credits")) : null,
      });
    } catch (failure) {
      setError(failure);
      return;
    } finally {
      setBusy(false);
    }

    // The course exists from here on; a later failure is not a create failure.
    formEl.reset();
    setError(null);
    await load();
  }

  async function onEnrol(studentId: string) {
    if (!token || !selected) return;
    try {
      // Idempotent on the server: enrolling someone already enrolled is a 200,
      // not an error, so no special-casing is needed here.
      await enrolments.create(token, studentId, selected.id);
      await openRoster(selected);
    } catch (failure) {
      setError(failure);
    }
  }

  async function onWithdraw(enrolmentId: string) {
    if (!token || !selected) return;
    try {
      await enrolments.withdraw(token, enrolmentId);
      await openRoster(selected);
    } catch (failure) {
      setError(failure);
    }
  }

  const enrolledIds = new Set(roster.map((entry) => entry.student.id));

  return (
    <Shell>
      <header className="page-head">
        <h1>Courses</h1>
      </header>

      <ErrorNote error={error} />

      {can("courses:write") ? (
        <form className="card row-form" onSubmit={onCreate}>
          <input name="code" placeholder="Code (e.g. COMP201)" required />
          <input name="title" placeholder="Title" required />
          <input name="term" placeholder="Term" />
          <input name="credits" type="number" min="0" placeholder="Credits" />
          <button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add course"}
          </button>
        </form>
      ) : null}

      <div className="split">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Term</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((course) => (
              <tr key={course.id} className={selected?.id === course.id ? "selected" : ""}>
                <td className="mono">{course.code}</td>
                <td>{course.title}</td>
                <td className="muted">{course.term ?? "—"}</td>
                <td>{course.status}</td>
                <td>
                  <button className="link" onClick={() => void openRoster(course)}>
                    Roster
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted centre-cell">
                  No courses yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {selected ? (
          <aside className="card">
            <h2>
              <span className="mono">{selected.code}</span> roster
            </h2>
            <p className="muted">{roster.length} enrolled</p>

            <ul className="list">
              {roster.map((entry) => (
                <li key={entry.enrolment_id}>
                  <span>
                    {entry.student.first_name} {entry.student.last_name}
                    <span className="muted"> · {entry.status}</span>
                  </span>
                  {can("enrolments:write") ? (
                    <button
                      className="link danger"
                      onClick={() => void onWithdraw(entry.enrolment_id)}
                    >
                      Withdraw
                    </button>
                  ) : null}
                </li>
              ))}
              {roster.length === 0 ? <li className="muted">Nobody enrolled.</li> : null}
            </ul>

            {can("enrolments:write") ? (
              <>
                <h3>Enrol a student</h3>
                <ul className="list">
                  {allStudents
                    .filter((student) => !enrolledIds.has(student.id))
                    .map((student) => (
                      <li key={student.id}>
                        <span>
                          {student.first_name} {student.last_name}
                          <span className="muted"> · {student.student_number}</span>
                        </span>
                        <button className="link" onClick={() => void onEnrol(student.id)}>
                          Enrol
                        </button>
                      </li>
                    ))}
                </ul>
              </>
            ) : null}
          </aside>
        ) : null}
      </div>
    </Shell>
  );
}
