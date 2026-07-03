import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addCards, dueCards, gradeCard, newCard, schedule } from "./decks";
import { loadProgress, recordReview, reviewsToday } from "./progress";
import { parseCards } from "./generate";

describe("parseCards", () => {
  it("pulls a JSON array of cards out of a noisy model reply", () => {
    const reply = 'Sure! Here are your cards:\n```json\n[{"front":"2+2","back":"4"},{"front":"Capital of France","back":"Paris"}]\n```\nHope that helps!';
    const cards = parseCards(reply);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({ front: "2+2", back: "4" });
  });

  it("drops malformed entries and returns [] on junk", () => {
    expect(parseCards('[{"front":"only front"}]')).toEqual([]);
    expect(parseCards("no json here")).toEqual([]);
  });
});

describe("SM-2 scheduling", () => {
  it("advances the interval on good grades (1 → 6 → longer)", () => {
    let card = newCard("q", "a", 0);
    card = schedule(card, 5, 0);
    expect(card.interval).toBe(1);
    card = schedule(card, 5, 0);
    expect(card.interval).toBe(6);
    card = schedule(card, 5, 0);
    expect(card.interval).toBeGreaterThan(6); // interval * ease
    expect(card.reps).toBe(3);
  });

  it("lapses a card back to a 1-day interval on a bad grade", () => {
    let card = newCard("q", "a", 0);
    card = schedule(card, 5, 0);
    card = schedule(card, 5, 0); // interval 6, reps 2
    card = schedule(card, 1, 0); // forgot
    expect(card.reps).toBe(0);
    expect(card.interval).toBe(1);
  });

  it("never lets the easiness factor drop below 1.3", () => {
    let card = newCard("q", "a", 0);
    for (let i = 0; i < 10; i++) card = schedule(card, 3, 0);
    expect(card.ease).toBeGreaterThanOrEqual(1.3);
  });
});

describe("deck store", () => {
  let cfg: string;
  let env: NodeJS.ProcessEnv;
  beforeEach(() => {
    cfg = mkdtempSync(join(tmpdir(), "tc-decks-"));
    env = { XDG_CONFIG_HOME: cfg };
  });
  afterEach(() => rmSync(cfg, { recursive: true, force: true }));

  it("adds cards and reports them as due immediately", () => {
    addCards("bio", [{ front: "Mitochondria?", back: "Powerhouse of the cell" }, { front: "", back: "skip" }], env);
    const due = dueCards("bio", env);
    expect(due).toHaveLength(1); // the empty card was skipped
    expect(due[0]!.front).toBe("Mitochondria?");
  });

  it("grading a card pushes it out of the due queue", () => {
    addCards("bio", [{ front: "q", back: "a" }], env);
    const card = dueCards("bio", env)[0]!;
    gradeCard("bio", card.id, 5, env);
    expect(dueCards("bio", env)).toHaveLength(0); // now scheduled a day out
  });
});

describe("study progress", () => {
  let cfg: string;
  let env: NodeJS.ProcessEnv;
  const day = (s: string) => new Date(`${s}T12:00:00Z`).getTime();
  beforeEach(() => {
    cfg = mkdtempSync(join(tmpdir(), "tc-prog-"));
    env = { XDG_CONFIG_HOME: cfg };
  });
  afterEach(() => rmSync(cfg, { recursive: true, force: true }));

  it("counts reviews per day and grows the streak on consecutive days", () => {
    recordReview(env, day("2026-01-01"));
    recordReview(env, day("2026-01-01"));
    expect(reviewsToday(env, day("2026-01-01"))).toBe(2);
    expect(loadProgress(env).streak).toBe(1);

    recordReview(env, day("2026-01-02"));
    expect(loadProgress(env).streak).toBe(2);
  });

  it("resets the streak after a missed day", () => {
    recordReview(env, day("2026-01-01"));
    recordReview(env, day("2026-01-03")); // skipped the 2nd
    expect(loadProgress(env).streak).toBe(1);
  });
});
