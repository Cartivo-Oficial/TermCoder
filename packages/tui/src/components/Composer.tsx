import { Box, Text, useStdout } from "ink";
import Spinner from "ink-spinner";
import type { Theme } from "../theme";
import type { TuiCommand } from "../commands";
import { CommandMenu } from "./CommandMenu";
import { MentionMenu } from "./MentionMenu";
import { MultilineInput, type MenuControl } from "./MultilineInput";
import { StatusBar } from "./StatusBar";

interface ComposerProps {
  theme: Theme;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  busy: boolean;
  disabled: boolean;
  status?: string;
  elapsed?: number;
  onHistory?: (dir: "up" | "down") => void;
  /** Command dropdown (typing "/…"). */
  commandMenu?: TuiCommand[];
  /** File dropdown (typing "@…"). */
  mentionMenu?: string[];
  menuSelected?: number;
  menuControl?: MenuControl;
  // Status bar meta.
  model: string;
  agent: string;
  cwd: string;
  tokens: number;
  lastCtx?: number;
  autoApprove: boolean;
  version?: string;
  ready?: boolean;
}

/** Bottom UI: dropdowns, the multi-line prompt (or busy line), and status bar. */
export function Composer(props: ComposerProps) {
  const { theme, value, onChange, onSubmit, busy, disabled, status, elapsed } = props;
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
                  placeholder="Type your message… (/ commands · $ sub-agent)"
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
                <HintKey theme={theme} k="/" label="commands" />
                <Text color={theme.border}>{"   "}</Text>
                <HintKey theme={theme} k="$" label="sub-agent" />
                <Text color={theme.border}>{"   "}</Text>
                <HintKey theme={theme} k="shift+tab" label="mode" />
                <Text color={theme.border}>{"   "}</Text>
                <HintKey theme={theme} k="ctrl+p" label="palette" />
                <Text color={theme.border}>{"   "}</Text>
                <HintKey theme={theme} k="esc" label="stop" />
              </Box>
            </>
          )}
        </Box>
      </Box>

      <StatusBar
        theme={theme}
        agent={props.agent}
        cwd={props.cwd}
        tokens={props.tokens}
        lastCtx={props.lastCtx}
        autoApprove={props.autoApprove}
        version={props.version}
        ready={props.ready}
      />
    </Box>
  );
}

/** A dim "key label" pair for the hint bar (e.g. `/ commands`). */
function HintKey({ theme, k, label }: { theme: Theme; k: string; label: string }) {
  return (
    <Text>
      <Text color={theme.accent}>{k}</Text>
      <Text color={theme.muted}>{` ${label}`}</Text>
    </Text>
  );
}
