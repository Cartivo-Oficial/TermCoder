import { Box, Text, useStdout } from "ink";
import Spinner from "ink-spinner";
import type { Theme } from "../theme";
import type { TuiCommand } from "../commands";
import { CommandMenu } from "./CommandMenu";
import { MentionMenu } from "./MentionMenu";
import { MultilineInput, type MenuControl } from "./MultilineInput";

interface ComposerProps {
  theme: Theme;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  busy: boolean;
  disabled: boolean;
  status?: string;
  elapsed?: number;
  tokens?: number;
  onHistory?: (dir: "up" | "down") => void;
  commandMenu?: TuiCommand[];
  mentionMenu?: string[];
  menuSelected?: number;
  menuControl?: MenuControl;
  model: string;
  agent: string;
  cwd: string;
}

function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function Composer(props: ComposerProps) {
  const { theme, value, onChange, onSubmit, busy, disabled, status, elapsed, tokens } = props;
  const showCommands = !busy && (props.commandMenu?.length ?? 0) > 0;
  const showMentions = !busy && !showCommands && (props.mentionMenu?.length ?? 0) > 0;
  const cols = useStdout().stdout?.columns ?? 80;
  const boxWidth = Math.max(30, Math.min(cols - 2, 96));

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="column" alignItems="center" width="100%">
        <Box flexDirection="column" width={boxWidth}>
          {showCommands ? (
            <CommandMenu theme={theme} commands={props.commandMenu!} selected={props.menuSelected ?? 0} />
          ) : null}
          {showMentions ? (
            <MentionMenu theme={theme} files={props.mentionMenu!} selected={props.menuSelected ?? 0} cwd={props.cwd} />
          ) : null}

          {busy ? (
            <Box paddingX={1}>
              <Text color={theme.accent}>
                <Spinner type="dots" />
              </Text>
              <Text color={theme.assistant}>{` ${status ?? "Thinking…"}`}</Text>
              {elapsed && elapsed > 0 ? <Text color={theme.muted}>{`  ${elapsed}s`}</Text> : null}
              {tokens && tokens > 0 ? <Text color={theme.muted}>{`  ${fmtTok(tokens)} tok`}</Text> : null}
              <Text color={theme.border}>{"  ·  "}</Text>
              <Text color={theme.muted}>esc to interrupt</Text>
            </Box>
          ) : (
            <>
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor={value.startsWith("/") ? theme.accent : value.startsWith("$") ? theme.running : theme.border}
                paddingX={1}
              >
                <MultilineInput
                  theme={theme}
                  value={value}
                  onChange={onChange}
                  onSubmit={onSubmit}
                  focus={!disabled}
                  placeholder="Type your message… (type / for commands)"
                  onHistory={props.onHistory}
                  menu={props.menuControl}
                />
              </Box>
              <Box paddingX={1}>
                <Text color={theme.accent} bold>
                  {props.agent.charAt(0).toUpperCase() + props.agent.slice(1)}
                </Text>
                <Text color={theme.muted}>{" · "}</Text>
                <Text color={theme.tool}>{props.model}</Text>
              </Box>
              <Box paddingX={1}>
                <HintKey theme={theme} k="shift+tab" label="mode" />
                <Text color={theme.border}>{"   "}</Text>
                <HintKey theme={theme} k="ctrl+p" label="palette" />
                <Text color={theme.border}>{"   "}</Text>
                <HintKey theme={theme} k="@" label="attach file" />
                <Text color={theme.border}>{"   "}</Text>
                <HintKey theme={theme} k="$" label="sub-agent" />
                <Text color={theme.border}>{"   "}</Text>
                <HintKey theme={theme} k="/" label="commands" />
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function HintKey({ theme, k, label }: { theme: Theme; k: string; label: string }) {
  return (
    <Text>
      <Text color={theme.accent}>{k}</Text>
      <Text color={theme.muted}>{` ${label}`}</Text>
    </Text>
  );
}
