import { useEffect, useState } from "react";
import { Box, Text, useStdout } from "ink";
import type { Theme } from "../theme";
import { wordLines, makeStars, renderStars } from "../logo";

// Two gradients across the wordmark: warm orange for "term", cool light for
// "coder" — so the logo shades like the pixel look instead of flat colour.
const TERM = ["#ffb066", "#ff9a45", "#ff8036", "#ff6a2b"];
const CODER = ["#f2f2f4", "#e2e2e6", "#d0d0d6", "#bebec4", "#acacb2"];

const STAR_ROWS = 4;

function LetterCols({ word, colors }: { word: string; colors: string[] }) {
  return (
    <Box flexDirection="row">
      {word.split("").map((ch, i) => (
        <Box key={i} flexDirection="column" marginRight={1}>
          {wordLines(ch).map((line, r) => (
            <Text key={r} color={colors[i % colors.length]} bold>
              {line}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}

interface HeroProps {
  theme: Theme;
  /** Freeze the twinkle (reduced motion / tests). */
  animate?: boolean;
}

/**
 * The empty-state hero: a gradient block wordmark inside a gently twinkling
 * starfield, centered. The starfield animates via a slow frame counter, so it
 * lives outside <Static> (which never re-renders).
 */
export function Hero({ theme, animate = true }: HeroProps) {
  const cols = useStdout().stdout?.columns ?? 80;
  const width = Math.max(30, Math.min(cols - 2, 78));
  const [frame, setFrame] = useState(0);
  const [top] = useState(() => makeStars(width, STAR_ROWS, Math.round(width * STAR_ROWS * 0.05), 7));
  const [bottom] = useState(() => makeStars(width, STAR_ROWS, Math.round(width * STAR_ROWS * 0.05), 53));

  useEffect(() => {
    if (!animate) return;
    // Animate the starfield for a short while, then settle. Continuous repaints
    // fight the terminal's own scrollback (scrolling up snaps back on redraw),
    // so we stop after the intro to keep scrolling smooth.
    let ticks = 0;
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % 1024);
      if (++ticks >= 14) clearInterval(id);
    }, 720);
    return () => clearInterval(id);
  }, [animate]);

  const topLines = renderStars(top, width, STAR_ROWS, frame);
  const bottomLines = renderStars(bottom, width, STAR_ROWS, frame + 3);

  return (
    <Box flexDirection="column" alignItems="center" width="100%" marginTop={2} marginBottom={1}>
      {topLines.map((line, i) => (
        <Text key={`t${i}`} color={theme.border}>
          {line}
        </Text>
      ))}
      <Box flexDirection="row" marginY={1}>
        <LetterCols word="TERM" colors={TERM} />
        <Text> </Text>
        <LetterCols word="CODER" colors={CODER} />
      </Box>
      <Text color={theme.muted}>your terminal coding agent</Text>
      <Text color={theme.border}>
        <Text color={theme.accent}>/</Text> commands
        {"   "}
        <Text color={theme.accent}>@</Text> files
        {"   "}
        <Text color={theme.accent}>shift+tab</Text> mode
      </Text>
      {bottomLines.map((line, i) => (
        <Text key={`b${i}`} color={theme.border}>
          {line}
        </Text>
      ))}
    </Box>
  );
}
