import { Box, Text, useStdout } from "ink";
import type { Theme } from "../theme";
import { wordLines, starfield } from "../logo";

interface BannerProps {
  theme: Theme;
  model: string;
  cwd: string;
  sessionId: string;
}

const TERM = ["#ffb066", "#ff9a45", "#ff8036", "#ff6a2b"];
const CODER = ["#f2f2f4", "#e2e2e6", "#d0d0d6", "#bebec4", "#acacb2"];

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

export function Banner({ theme }: BannerProps) {
  const cols = useStdout().stdout?.columns ?? 80;
  const width = Math.max(24, Math.min(cols - 2, 64));
  const top = starfield(width, 2, 7);
  const bottom = starfield(width, 2, 29);

  return (
    <Box flexDirection="column" alignItems="center" width="100%" marginY={1}>
      {top.map((line, i) => (
        <Text key={`t${i}`} color={theme.border}>
          {line}
        </Text>
      ))}
      <Box flexDirection="row" marginY={1}>
        <LetterCols word="TERM" colors={TERM} />
        <Text> </Text>
        <LetterCols word="CODER" colors={CODER} />
      </Box>
      <Text color={theme.muted}>your terminal coding agent · type / for commands</Text>
      {bottom.map((line, i) => (
        <Text key={`b${i}`} color={theme.border}>
          {line}
        </Text>
      ))}
    </Box>
  );
}
