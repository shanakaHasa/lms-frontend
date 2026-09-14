"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import ErrorNote from "@/components/ErrorNote";
import Shell from "@/components/Shell";
import { students } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Student } from "@/lib/types";

export default function StudentsPage() {
  const { session, can } = useAuth();
  const [rows, setRows] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const token = session?.accessToken;

  const load = useCallback(
    async (q: string) => {
      if (!token) return;
      try {
        const page = await students.list(token, { q: q || undefined });
        setRows(page.items);
        setTotal(page.total);
        setError(null);
      } catch (failure) {
        setError(failure);
      }
    },
    [token],
  );

  useEffect(() => {
    void load("");
  }, [load]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(search), 250);
    return () => clearTimeout(timer);
  }, [search, load]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await students.create(token, {
        student_number: String(form.get("student_number")),
        first_name: String(form.get("first_name")),
        last_name: String(form.get("last_name")),
        email: String(form.get("email")),
        year_level: form.get("year_level") ? Number(form.get("year_level")) : null,
      });
      event.currentTarget.reset();
      setError(null);
      await load(search);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!token) return;
    try {
      await students.remove(token, id);
      await load(search);
    } catch (failure) {
      setError(failure);
    }
  }

  return (
    <Shell>
      <header className="page-head">
        <h1>Students</h1>
        <input
          className="search"
          placeholder="Search name, number or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>

      <ErrorNote error={error} />

      {can("students:write") ? (
        <form className="card row-form" onSubmit={onCreate}>
          <input name="student_number" placeholder="Number" required />
          <input name="first_name" placeholder="First name" required />
          <input name="last_name" placeholder="Last name" required />
          <input name="email" type="email" placeholder="Email" required />
          <input name="year_level" type="number" min="1" max="20" placeholder="Year" />
          <button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add student"}
          </button>
        </form>
      ) : null}

      <p className="muted">{total} student{total === 1 ? "" : "s"}</p>

      <table className="table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Name</th>
            <th>Email</th>
            <th>Year</th>
            <th>Status</th>
            {can("students:write") ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((student) => (
            <tr key={student.id}>
              <td className="mono">{student.student_number}</td>
              <td>
                {student.first_name} {student.last_name}
              </td>
              <td className="muted">{student.email}</td>
              <td>{student.year_level ?? "—"}</td>
              <td>{student.status}</td>
              {can("students:write") ? (
                <td>
                  <button className="link danger" onClick={() => onDelete(student.id)}>
                    Remove
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted centre-cell">
                No students yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Shell>
  );
}
