import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { configFile } from "../util/paths";

/**
 * Spaced-repetition flashcards for the study assistant (termexplorer), using the
 * SM-2 algorithm. Decks live in `~/.config/termcoder/decks.json` and sync across
 * machines through the Phase-1 sync layer (the "decks" store).
 */

const DAY = 86_400_000;

/** A single flashcard with its SM-2 scheduling state. */
export interface Card {
  id: string;
  front: string;
  back: string;
  ease: number; // easiness factor (>= 1.3), starts at 2.5
  interval: number; // days until the next review
  reps: number; // consecutive correct reviews
  due: number; // epoch ms when the card is next due
  createdAt: number;
}

export interface Deck {
  name: string;
  cards: Card[];
  updatedAt: number;
}

export type DeckMap = Record<string, Deck>;

/** A review grade: 0 (blackout) … 5 (perfect recall). 3+ counts as correct. */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

function file(env: NodeJS.ProcessEnv): string {
  return configFile("decks.json", env);
}

export function loadDecks(env: NodeJS.ProcessEnv = process.env): DeckMap {
  try {
    const f = file(env);
    if (!existsSync(f)) return {};
    const data = JSON.parse(readFileSync(f, "utf8")) as unknown;
    return data && typeof data === "object" ? (data as DeckMap) : {};
  } catch {
    return {};
  }
}

export function saveDecks(decks: DeckMap, env: NodeJS.ProcessEnv = process.env): void {
  const f = file(env);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(decks, null, 2), "utf8");
}

/** A fresh card, due immediately. */
export function newCard(front: string, back: string, now = Date.now()): Card {
  return { id: randomUUID(), front, back, ease: 2.5, interval: 0, reps: 0, due: now, createdAt: now };
}

/**
 * Apply one SM-2 review to a card. A grade below 3 lapses the card (back to a
 * 1-day interval); 3+ advances it and nudges the easiness factor.
 */
export function schedule(card: Card, grade: Grade, now = Date.now()): Card {
  let { ease, interval, reps } = card;
  if (grade < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(interval * ease);
    ease = Math.max(1.3, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  }
  return { ...card, ease, interval, reps, due: now + interval * DAY };
}

/** Add cards to a deck (creating it if needed) and persist. Returns the deck. */
export function addCards(
  deckName: string,
  cards: Array<{ front: string; back: string }>,
  env: NodeJS.ProcessEnv = process.env,
): Deck {
  const decks = loadDecks(env);
  const deck = decks[deckName] ?? { name: deckName, cards: [], updatedAt: Date.now() };
  for (const c of cards) {
    if (c.front.trim() && c.back.trim()) deck.cards.push(newCard(c.front.trim(), c.back.trim()));
  }
  deck.updatedAt = Date.now();
  decks[deckName] = deck;
  saveDecks(decks, env);
  return deck;
}

/** Cards in a deck that are due for review now (oldest-due first). */
export function dueCards(deckName: string, env: NodeJS.ProcessEnv = process.env, now = Date.now()): Card[] {
  const deck = loadDecks(env)[deckName];
  if (!deck) return [];
  return deck.cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due);
}

/** Grade a card in a deck, updating its schedule; returns the updated card. */
export function gradeCard(
  deckName: string,
  cardId: string,
  grade: Grade,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): Card | undefined {
  const decks = loadDecks(env);
  const deck = decks[deckName];
  if (!deck) return undefined;
  const idx = deck.cards.findIndex((c) => c.id === cardId);
  if (idx === -1) return undefined;
  const updated = schedule(deck.cards[idx]!, grade, now);
  deck.cards[idx] = updated;
  deck.updatedAt = now;
  saveDecks(decks, env);
  return updated;
}

/** A summary of every deck: total cards and how many are due now. */
export function deckSummaries(
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): Array<{ name: string; total: number; due: number }> {
  const decks = loadDecks(env);
  return Object.values(decks)
    .map((d) => ({ name: d.name, total: d.cards.length, due: d.cards.filter((c) => c.due <= now).length }))
    .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name));
}
