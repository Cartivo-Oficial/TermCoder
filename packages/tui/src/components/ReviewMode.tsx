import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Card } from "@termcoder/core";
import type { Theme } from "../theme";

interface ReviewModeProps {
  theme: Theme;
  deck: string;
  cards: Card[];
  onGrade: (cardId: string, grade: number) => void;
  onExit: (reviewed: number) => void;
}

const GRADES = "0 = blackout · 1–2 = wrong · 3 = hard · 4 = good · 5 = easy";

export function ReviewMode({ theme, deck, cards, onGrade, onExit }: ReviewModeProps) {
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const card = cards[i];

  useInput((input, key) => {
    if (key.escape || input === "q") return onExit(reviewed);
    if (!card) return;
    if (!revealed) {
      if (key.return || input === " ") setRevealed(true);
      return;
    }
    if (/^[0-5]$/.test(input)) {
      onGrade(card.id, Number(input));
      const done = reviewed + 1;
      setReviewed(done);
      const next = i + 1;
      if (next >= cards.length) return onExit(done);
      setI(next);
      setRevealed(false);
    }
  });

  if (!card) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.success}>All caught up — nothing due in “{deck}”. 🎉</Text>
        <Text color={theme.border}>Press any key…</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={2} paddingY={1}>
      <Text color={theme.muted}>{`Review · ${deck} · card ${i + 1}/${cards.length}`}</Text>
      <Box marginTop={1}>
        <Text color={theme.assistant} bold>
          {card.front}
        </Text>
      </Box>
      {revealed ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.border}>{"─".repeat(24)}</Text>
          <Text color={theme.success}>{card.back}</Text>
          <Box marginTop={1}>
            <Text color={theme.border}>{`How well did you know it?  ${GRADES}`}</Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color={theme.border}>space / enter to reveal · esc to stop</Text>
        </Box>
      )}
    </Box>
  );
}
