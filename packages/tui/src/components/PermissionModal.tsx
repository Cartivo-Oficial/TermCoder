import { Box, Text, useInput } from "ink";
import type { PermissionRequest, PermissionDecision } from "@termcoder/core";
import type { Theme } from "../theme";

interface PermissionModalProps {
  theme: Theme;
  request: PermissionRequest;
  onDecision: (decision: PermissionDecision) => void;
}

/** Blocking prompt shown before a mutating tool runs. Keys: a / d / A. */
export function PermissionModal({ theme, request, onDecision }: PermissionModalProps) {
  useInput((input) => {
    if (input === "a") onDecision("allow");
    else if (input === "A") onDecision("allow-always");
    else if (input === "d") onDecision("deny");
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.accent}
      paddingX={1}
      marginTop={1}
    >
      <Text>
        <Text color={theme.accent} bold>
          permission{" "}
        </Text>
        <Text>{request.title}</Text>
      </Text>
      {request.detail ? (
        <Box marginTop={1}>
          <Text color={theme.muted}>{request.detail}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text color={theme.muted}>
          <Text color={theme.success} bold>
            a
          </Text>
          llow ·{" "}
          <Text color={theme.error} bold>
            d
          </Text>
          eny ·{" "}
          <Text color={theme.primary} bold>
            A
          </Text>
          lways
        </Text>
      </Box>
    </Box>
  );
}
