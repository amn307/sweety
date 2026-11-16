
import { useEffect, useState } from "react";
import {
  api,
  SLOT_LABELS,
  type Reading,
  type Report,
  type Slot,
  type User,
} from "./api";
import "./App.css";

type AuthResponse = { user: User; token: string };
type ReportType = "daily" | "mtd" | "monthly";

const SLOTS = Object.keys(SLOT_LABELS) as Slot[];

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(value: string) {
  return new Date(value.slice(0, 10) + "T12:00:00")
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
}

const emptyForm = () => ({
  date: localDate(),
  slot: "MORNING" as Slot,
  value: "",
});

export default function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("sweety_token") || ""
  );
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [readings, setReadings] = useState<Reading[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);

  function logout() {
    sessionStorage.removeItem("sweety_token");
    setToken("");
    setUser(null);
    setReadings([]);
    setReport(null);
    setError("");
  }

  useEffect(() => {
    if (!token) return;

    let active = true;

    api<{ user: User }>("/me", {}, token)
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) logout();
      });

    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;

    let active = true;

    Promise.all([
      api<{ readings: Reading[] }>("/readings", {}, token),
      api<Report>(
        `/reports/${reportType}?date=${selectedDate}`,
        {},
        token
      ),
    ])
      .then(([readingData, reportData]) => {
        if (!active) return;
        setReadings(readingData.readings);
        setReport(reportData);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => { active = false; };
  }, [token, user, selectedDate, reportType, refresh]);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      const payload =
        authMode === "register"
          ? authForm
          : { email: authForm.email, password: authForm.password };

      const data = await api<AuthResponse>(
        `/auth/${authMode}`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      sessionStorage.setItem("sweety_token", data.token);
      setUser(data.user);
      setToken(data.token);
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveReading(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.value.trim()) {
      setError("Please enter a glucose value.");
      return;
    }

    const value = Number(form.value);

    if (!Number.isInteger(value) || value < 40 || value > 600) {
      setError("Value must be between 40 and 600 mg/dl.");
      return;
    }

    if (form.date > localDate()) {
      setError("Date cannot be in the future.");
      return;
    }

    setLoading(true);

    try {
      await api(
        editingId ? `/readings/${editingId}` : "/readings",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify({
            date: form.date,
            slot: form.slot,
            value,
          }),
        },
        token
      );

      setForm(emptyForm());
      setEditingId(null);
      setRefresh((n) => n + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function editReading(reading: Reading) {
    setEditingId(reading.id);
    setForm({
      date: reading.date.slice(0, 10),
      slot: reading.slot,
      value: String(reading.value),
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteReading(id: number) {
    if (!window.confirm("Delete this glucose reading?")) return;

    setError("");

    try {
      await api(`/readings/${id}`, { method: "DELETE" }, token);
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm());
      }
      setRefresh((n) => n + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!token || !user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand">sweety<span>.</span></div>
          <p className="muted">Your personal glucose journal</p>
          <h1>{authMode === "login" ? "Welcome back" : "Create an account"}</h1>
          <p className="muted">
            {authMode === "login"
              ? "Sign in to view your readings."
              : "Start tracking your glucose readings."}
          </p>

          <form onSubmit={submitAuth}>
            {authMode === "register" && (
              <label>
                Full name
                <input
                  required
                  value={authForm.name}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, name: e.target.value })
                  }
                  placeholder="Your name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                required
                type="email"
                value={authForm.email}
                onChange={(e) =>
                  setAuthForm({ ...authForm, email: e.target.value })
                }
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                minLength={authMode === "register" ? 8 : undefined}
                value={authForm.password}
                onChange={(e) =>
                  setAuthForm({ ...authForm, password: e.target.value })
                }
                placeholder="Enter your password"
              />
            </label>

            {authError && <p className="error" role="alert">{authError}</p>}

            <button disabled={loading} type="submit" className="primary">
              {loading ? "Please wait..." :
                authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="switch-auth">
            {authMode === "login" ? "New to Sweety?" : "Already registered?"}
            {" "}
            <button
              className="text-button"
              onClick={() => {
                setAuthError("");
                setAuthMode(authMode === "login" ? "register" : "login");
              }}
            >
              {authMode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  const dayReadings = readings.filter(
    (r) => r.date.slice(0, 10) === selectedDate
  );

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">sweety<span>.</span></div>
          <div className="header-actions">
            <span className="welcome">Hi, {user.name}</span>
            <button className="secondary" onClick={logout}>Log out</button>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="page-heading">
          <div>
            <p className="eyebrow">YOUR HEALTH JOURNAL</p>
            <h1>Glucose dashboard</h1>
            <p className="muted">Keep track of your daily readings.</p>
          </div>
          <div className="date-control">
            <label htmlFor="selected-date">Report date</label>
            <input
              id="selected-date"
              type="date"
              max={localDate()}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </section>

        {error && (
          <div className="error banner" role="alert">{error}</div>
        )}

        <div className="dashboard-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>{editingId ? "Edit reading" : "Add a reading"}</h2>
                <p className="muted">Record your glucose level in mg/dl.</p>
              </div>
            </div>

            <form onSubmit={saveReading}>
              <label>
                Date
                <input
                  type="date"
                  required
                  max={localDate()}
                  value={form.date}
                  onChange={(e) =>
                    setForm({ ...form, date: e.target.value })
                  }
                />
              </label>

              <label>
                Time slot
                <select
                  value={form.slot}
                  onChange={(e) =>
                    setForm({ ...form, slot: e.target.value as Slot })
                  }
                >
                  {SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {SLOT_LABELS[slot]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Glucose value (mg/dl)
                <input
                  type="number"
                  required
                  min="40"
                  max="600"
                  step="1"
                  placeholder="e.g. 110"
                  value={form.value}
                  onChange={(e) =>
                    setForm({ ...form, value: e.target.value })
                  }
                />
              </label>

              <button className="primary" disabled={loading} type="submit">
                {loading ? "Saving..." :
                  editingId ? "Save changes" : "+ Add reading"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="secondary full-width"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm());
                    setError("");
                  }}
                >
                  Cancel editing
                </button>
              )}
            </form>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Daily readings</h2>
                <p className="muted">{displayDate(selectedDate)}</p>
              </div>
              <span className="pill">{dayReadings.length}/4 recorded</span>
            </div>

            <div className="reading-list">
              {SLOTS.map((slot) => {
                const reading = dayReadings.find((r) => r.slot === slot);

                return (
                  <div className="reading-row" key={slot}>
                    <div>
                      <p className="reading-label">{SLOT_LABELS[slot]}</p>
                      <p className="reading-value">
                        {reading ? (
                          <>{reading.value} <small>mg/dl</small></>
                        ) : (
                          <span className="muted">Not recorded</span>
                        )}
                      </p>
                    </div>
                    {reading && (
                      <div className="row-actions">
                        <button
                          className="text-button"
                          onClick={() => editReading(reading)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-button danger"
                          onClick={() => deleteReading(reading.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="panel reports-panel">
          <div className="section-heading">
            <div>
              <h2>Glucose reports</h2>
              <p className="muted">Your reading statistics.</p>
            </div>
          </div>

          <div className="tabs">
            {([
              ["daily", "Daily"],
              ["mtd", "Month-to-date"],
              ["monthly", "Previous month"],
            ] as [ReportType, string][]).map(([type, label]) => (
              <button
                key={type}
                className={reportType === type ? "tab active" : "tab"}
                onClick={() => setReportType(type)}
              >
                {label}
              </button>
            ))}
          </div>

          {report && (
            <>
              <p className="report-range muted">
                {report.report === "daily"
                  ? displayDate(report.date || selectedDate)
                  : `${displayDate(report.startDate!)} – ${displayDate(report.endDate!)}`}
              </p>

              {report.count === 0 ? (
                <div className="empty-state">
                  <h3>No readings yet</h3>
                  <p className="muted">
                    No glucose readings were found for this period.
                  </p>
                </div>
              ) : (
                <>
                  <div className="stats-grid">
                    {[
                      ["Highest", report.highest],
                      ["Lowest", report.lowest],
                      ["Average", report.average],
                      ["Readings", report.count],
                    ].map(([label, value]) => (
                      <div className="stat-card" key={label}>
                        <p className="muted">{label}</p>
                        <strong>{value}</strong>
                        {label !== "Readings" && <small>mg/dl</small>}
                      </div>
                    ))}
                  </div>

                  {reportType === "daily" && report.readings && (
                    <div className="report-details">
                      <h3>Reading breakdown</h3>
                      {SLOTS.filter((slot) =>
                        report.readings!.some((r) => r.slot === slot)
                      ).map((slot) => {
                        const reading = report.readings!.find(
                          (r) => r.slot === slot
                        )!;
                        return (
                          <div className="breakdown-row" key={slot}>
                            <span>{SLOT_LABELS[slot]}</span>
                            <strong>{reading.value} mg/dl</strong>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>

        <section className="panel history-panel">
          <h2>Reading history</h2>
          {readings.length === 0 ? (
            <p className="muted">Your readings will appear here.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time slot</th>
                    <th>Value</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((reading) => (
                    <tr key={reading.id}>
                      <td>{displayDate(reading.date)}</td>
                      <td>{SLOT_LABELS[reading.slot]}</td>
                      <td>{reading.value} mg/dl</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => editReading(reading)}
                        >
                          Edit
                        </button>
                        {" "}
                        <button
                          className="text-button danger"
                          onClick={() => deleteReading(reading.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer>
          Sweety · Personal glucose tracking journal
        </footer>
      </main>
    </div>
  );
}
