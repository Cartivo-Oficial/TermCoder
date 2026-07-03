import { useEffect, useState } from "react";

interface StudyProps {
  port: number;
  onClose: () => void;
}
interface DeckSummary {
  name: string;
  total: number;
  due: number;
}
interface Overview {
  decks: DeckSummary[];
  streak: number;
  reviewsToday: number;
}
interface Card {
  id: string;
  front: string;
  back: string;
}
interface ReviewState {
  deck: string;
  cards: Card[];
  i: number;
  revealed: boolean;
}

const GRADE_HINT = "0 = blackout · 1–2 = wrong · 3 = hard · 4 = good · 5 = easy";

/** The desktop Study overlay: decks, spaced-repetition review, and generation. */
export function Study({ port, onClose }: StudyProps) {
  const httpBase = `http://localhost:${port}`;
  const [ov, setOv] = useState<Overview>({ decks: [], streak: 0, reviewsToday: 0 });
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [review, setReview] = useState<ReviewState | null>(null);

  function load() {
    fetch(`${httpBase}/study`)
      .then((r) => r.json())
      .then((d) => setOv(d as Overview))
      .catch(() => {});
  }
  useEffect(load, []);

  async function generate() {
    if (!topic.trim() || busy) return;
    setBusy(true);
    setMsg("Writing flashcards… (the free model can take a moment)");
    try {
      const r = await fetch(`${httpBase}/study/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const d = (await r.json()) as { added?: number; deck?: string; error?: string };
      if (!r.ok) setMsg(d.error ?? "Failed — try again.");
      else {
        setMsg(`Added ${d.added} cards to “${d.deck}”.`);
        setTopic("");
        load();
      }
    } catch {
      setMsg("Couldn't reach the model. Try again in a moment.");
    }
    setBusy(false);
  }

  async function startReview(deck: string) {
    const cards = (await (await fetch(`${httpBase}/study/due?deck=${encodeURIComponent(deck)}`)).json()) as Card[];
    if (!cards.length) {
      setMsg(`Nothing due in “${deck}”. 🎉`);
      return;
    }
    setMsg("");
    setReview({ deck, cards, i: 0, revealed: false });
  }

  async function grade(g: number) {
    if (!review) return;
    const card = review.cards[review.i]!;
    await fetch(`${httpBase}/study/grade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deck: review.deck, cardId: card.id, grade: g }),
    }).catch(() => {});
    const next = review.i + 1;
    if (next >= review.cards.length) {
      setReview(null);
      setMsg("Review done! 🔥");
      load();
    } else {
      setReview({ ...review, i: next, revealed: false });
    }
  }

  if (review) {
    const card = review.cards[review.i]!;
    return (
      <div className="settings" onClick={onClose}>
        <div className="settings-card" style={{ maxWidth: 540, width: "92%", minHeight: 0 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: "20px 24px" }}>
            <div className="hint" style={{ marginBottom: 14 }}>
              {review.deck} · card {review.i + 1}/{review.cards.length}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 18 }}>{card.front}</div>
            {review.revealed ? (
              <>
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, fontSize: 16, color: "var(--accent)" }}>
                  {card.back}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
                  {[0, 1, 2, 3, 4, 5].map((g) => (
                    <button key={g} className="settings-btn" style={{ minWidth: 40 }} onClick={() => void grade(g)}>
                      {g}
                    </button>
                  ))}
                </div>
                <div className="hint" style={{ marginTop: 8 }}>{GRADE_HINT}</div>
              </>
            ) : (
              <button className="settings-btn" onClick={() => setReview({ ...review, revealed: true })}>
                Reveal answer
              </button>
            )}
            <div style={{ marginTop: 20 }}>
              <button
                className="settings-btn"
                onClick={() => {
                  setReview(null);
                  load();
                }}
              >
                Stop
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings" onClick={onClose}>
      <div className="settings-card" style={{ maxWidth: 560, width: "92%" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 0" }}>
          <h3 style={{ margin: 0 }}>📚 Study</h3>
          <button className="settings-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "8px 24px 24px" }}>
          <div className="hint" style={{ marginBottom: 16 }}>
            Streak: {ov.streak} 🔥 · {ov.reviewsToday} reviewed today
          </div>

          <div className="provider-key" style={{ marginBottom: 14 }}>
            <input
              className="settings-input"
              placeholder="New flashcards about… (e.g. the water cycle)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void generate();
              }}
            />
            <button className="settings-btn" disabled={!topic.trim() || busy} onClick={() => void generate()}>
              {busy ? "Making…" : "Generate"}
            </button>
          </div>
          {msg && <p className="hint" style={{ marginTop: -6, marginBottom: 14 }}>{msg}</p>}

          {ov.decks.length === 0 ? (
            <p className="hint">No decks yet — type a topic above and hit Generate.</p>
          ) : (
            ov.decks.map((d) => (
              <div key={d.name} className="srow" style={{ alignItems: "center" }}>
                <div className="srow-text">
                  <div className="srow-title">{d.name}</div>
                  <div className="hint">
                    {d.due} due · {d.total} cards
                  </div>
                </div>
                <button className="settings-btn" disabled={d.due === 0} onClick={() => void startReview(d.name)}>
                  {d.due > 0 ? `Review (${d.due})` : "Done"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
