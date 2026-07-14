import { useEffect, useState } from "react";
import { useI18n } from "./i18n";

interface JoinedClass {
  code: string;
  name: string;
  role: "teacher" | "student";
}
interface Assignment {
  id: string;
  title: string;
  description?: string;
  due?: string;
}
interface Submission {
  user: string;
  assignmentId: string;
  link: string;
  note?: string;
  at: string;
}
interface Grade {
  user: string;
  assignmentId: string;
  grade: string;
  feedback?: string;
  at: string;
}

interface ClassroomPanelProps {
  port: number;
  onClose: () => void;
  onUpgrade: () => void;
}

export function ClassroomPanel({ port, onClose, onUpgrade }: ClassroomPanelProps) {
  const { t } = useI18n();
  const httpBase = `http://localhost:${port}`;
  const [classes, setClasses] = useState<JoinedClass[]>([]);
  const [selected, setSelected] = useState<JoinedClass | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [roster, setRoster] = useState<Array<{ user: string; at: string }>>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [aTitle, setATitle] = useState("");
  const [aDue, setADue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refreshList() {
    fetch(`${httpBase}/classrooms`)
      .then((r) => r.json())
      .then((list) => setClasses(Array.isArray(list) ? (list as JoinedClass[]) : []))
      .catch(() => setClasses([]));
  }
  useEffect(refreshList, [httpBase]);

  async function post(body: Record<string, unknown>): Promise<unknown | null> {
    setError(null);
    const res = await fetch(`${httpBase}/classroom`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 402) {
      onUpgrade();
      return null;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((data as { error?: string }).error ?? t("class.failed"));
      return null;
    }
    return data;
  }

  async function open(c: JoinedClass) {
    setSelected(c);
    setAssignments([]);
    setRoster([]);
    setSubs([]);
    setGrades([]);
    setBusy(true);
    const detail = (await post({ action: "fetch", code: c.code })) as { assignments?: Assignment[] } | null;
    if (detail?.assignments) setAssignments(detail.assignments);
    if (c.role === "teacher") {
      const r = (await post({ action: "roster", code: c.code })) as Array<{ user: string; at: string }> | null;
      if (Array.isArray(r)) setRoster(r);
      const s = (await post({ action: "submissions", code: c.code })) as Submission[] | null;
      if (Array.isArray(s)) setSubs(s);
      const g = (await post({ action: "grades", code: c.code })) as Grade[] | null;
      if (Array.isArray(g)) setGrades(g);
    }
    setBusy(false);
  }

  async function gradeSub(assignmentId: string, user: string) {
    if (!selected) return;
    const key = `${assignmentId}::${user}`;
    const grade = (gradeDrafts[key] ?? "").trim();
    if (!grade) return;
    const ok = await post({ action: "grade", code: selected.code, assignmentId, user, grade });
    if (ok) {
      setGradeDrafts((prev) => ({ ...prev, [key]: "" }));
      const g = (await post({ action: "grades", code: selected.code })) as Grade[] | null;
      if (Array.isArray(g)) setGrades(g);
    }
  }

  async function createClass() {
    if (!newName.trim()) return;
    const c = (await post({ action: "create", name: newName.trim() })) as JoinedClass | null;
    if (c) {
      setNewName("");
      refreshList();
      void open(c);
    }
  }
  async function joinClass() {
    if (!joinCode.trim()) return;
    const r = (await post({ action: "join", code: joinCode.trim() })) as { classroom?: { name?: string } } | null;
    if (r) {
      setJoinCode("");
      refreshList();
    }
  }
  async function addAssignment() {
    if (!selected || !aTitle.trim()) return;
    const a = (await post({ action: "assign", code: selected.code, title: aTitle.trim(), due: aDue.trim() || undefined })) as Assignment | null;
    if (a) {
      setATitle("");
      setADue("");
      void open(selected);
    }
  }

  return (
    <div className="settings" onClick={onClose}>
      <div className="settings-card room-card" style={{ maxWidth: 620, width: "94%", minHeight: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="room-head">
          <h3>{t("class.title")}</h3>
          <button className="icon sm" title={t("room.close")} onClick={onClose}>×</button>
        </div>

        {error ? <p className="pro-err">{error}</p> : null}

        {!selected ? (
          <>
            <p className="hint" style={{ marginTop: 0 }}>{t("class.subtitle")}</p>
            <label className="room-label">{t("class.yours")}</label>
            <div className="class-list">
              {classes.length === 0 ? (
                <p className="hint">{t("class.none")}</p>
              ) : (
                classes.map((c) => (
                  <div className="class-row" key={c.code} onClick={() => void open(c)}>
                    <span className="class-name">{c.name}</span>
                    <span className="class-role">{c.role === "teacher" ? t("class.teacher") : t("class.student")}</span>
                  </div>
                ))
              )}
            </div>
            <div className="class-forms">
              <div className="class-form">
                <label className="room-label">{t("class.create")}</label>
                <div className="class-inline">
                  <input className="settings-input" value={newName} placeholder={t("class.namePlaceholder")} onChange={(e) => setNewName(e.target.value)} />
                  <button className="btn-2 go" onClick={() => void createClass()}>{t("class.createBtn")}</button>
                </div>
                <p className="hint">{t("class.createHint")}</p>
              </div>
              <div className="class-form">
                <label className="room-label">{t("class.join")}</label>
                <div className="class-inline">
                  <input className="settings-input" value={joinCode} placeholder={t("class.codePlaceholder")} onChange={(e) => setJoinCode(e.target.value)} />
                  <button className="btn-2" onClick={() => void joinClass()}>{t("class.joinBtn")}</button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <button className="class-back" onClick={() => setSelected(null)}>← {t("class.back")}</button>
            <div className="class-detail-head">
              <span className="class-name">{selected.name}</span>
              <span className="class-role">{selected.role === "teacher" ? t("class.teacher") : t("class.student")}</span>
            </div>

            {selected.role === "teacher" ? (
              <>
                <label className="room-label">{t("class.newAssignment")}</label>
                <div className="class-inline">
                  <input className="settings-input" value={aTitle} placeholder={t("class.assignPlaceholder")} onChange={(e) => setATitle(e.target.value)} />
                  <input className="settings-input class-due" value={aDue} placeholder={t("class.duePlaceholder")} onChange={(e) => setADue(e.target.value)} />
                  <button className="btn-2 go" onClick={() => void addAssignment()}>{t("class.add")}</button>
                </div>
              </>
            ) : null}

            <label className="room-label">{t("class.assignments")} · {assignments.length}</label>
            <div className="class-list">
              {busy ? (
                <p className="hint">{t("class.loading")}</p>
              ) : assignments.length === 0 ? (
                <p className="hint">{t("class.noAssignments")}</p>
              ) : (
                assignments.map((a) => {
                  const aSubs = subs.filter((s) => s.assignmentId === a.id);
                  return (
                    <div className="class-assignment" key={a.id}>
                      <div className="class-arow">
                        <span className="class-name">{a.title}</span>
                        {a.due ? <span className="class-role">{t("class.dueLabel")} {a.due}</span> : null}
                        {selected.role === "teacher" ? <span className="class-count">{aSubs.length} {t("class.submissions")}</span> : null}
                      </div>
                      {selected.role === "teacher" && aSubs.length ? (
                        <div className="class-subs">
                          {aSubs.map((s, i) => {
                            const g = grades.find((x) => x.assignmentId === a.id && x.user === s.user);
                            const key = `${a.id}::${s.user}`;
                            return (
                              <div className="class-sub" key={i}>
                                <span className="class-sub-user">@{s.user}</span>
                                <a className="class-sub-link" href={s.link} target="_blank" rel="noopener">{t("class.openSubmission")}</a>
                                {s.note ? <span className="class-sub-note">{s.note}</span> : null}
                                {g ? <span className="class-grade">{g.grade}</span> : null}
                                <span className="class-grade-form">
                                  <input
                                    className="settings-input class-grade-input"
                                    value={gradeDrafts[key] ?? ""}
                                    placeholder={g ? g.grade : t("class.gradePlaceholder")}
                                    onChange={(e) => setGradeDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") void gradeSub(a.id, s.user); }}
                                  />
                                  <button className="settings-btn sm" onClick={() => void gradeSub(a.id, s.user)}>{t("class.gradeBtn")}</button>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            {selected.role === "teacher" ? (
              <>
                <label className="room-label">{t("class.roster")} · {roster.length}</label>
                <div className="room-people">
                  {roster.length === 0 ? (
                    <span className="hint">{t("class.noStudents")}</span>
                  ) : (
                    roster.map((r) => <span className="room-chip" key={r.user}>@{r.user}</span>)
                  )}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
