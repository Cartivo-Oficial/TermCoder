import { useState, useRef, useEffect } from "react";
import { useI18n } from "./i18n";
import { IconClose, IconSend, IconWand } from "./Icons";

interface InlineAIChatProps {
  position: { line: number; character: number };
  selectedText?: string;
  onSendMessage: (message: string, context?: { selectedText?: string; position?: { line: number; character: number } }) => Promise<string>;
  onClose: () => void;
  onApplySuggestion: (suggestion: string) => void;
}

export function InlineAIChat({
  position,
  selectedText,
  onSendMessage,
  onClose,
  onApplySuggestion,
}: InlineAIChatProps) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.focus();
    }
  }, []);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const result = await onSendMessage(message, {
        selectedText,
        position,
      });
      setResponse(result);
    } catch (error) {
      setResponse("Error: Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  const quickActions = [
    { label: "Explain this code", prompt: "Explain this code" },
    { label: "Refactor", prompt: "Refactor this code to be more readable" },
    { label: "Fix bugs", prompt: "Find and fix any bugs in this code" },
    { label: "Add comments", prompt: "Add helpful comments to this code" },
    { label: "Optimize", prompt: "Optimize this code for performance" },
  ];

  return (
    <div className="inline-ai-chat" ref={chatRef} tabIndex={-1}>
      <div className="inline-ai-chat-header">
        <span className="inline-ai-chat-title">
          <IconWand />
          AI Assistant
        </span>
        <button
          className="inline-ai-chat-close"
          onClick={onClose}
          title="Close"
        >
          <IconClose />
        </button>
      </div>

      <div className="inline-ai-chat-body">
        {selectedText && (
          <div className="inline-ai-chat-context">
            <div className="inline-ai-chat-context-label">Selected:</div>
            <div className="inline-ai-chat-context-text">
              {selectedText.substring(0, 200)}
              {selectedText.length > 200 && "..."}
            </div>
          </div>
        )}

        <div className="inline-ai-chat-quick-actions">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="inline-ai-chat-quick-action"
              onClick={() => {
                setMessage(action.prompt);
                handleSend();
              }}
              disabled={isLoading}
            >
              {action.label}
            </button>
          ))}
        </div>

        {response && (
          <div className="inline-ai-chat-response">
            <div className="inline-ai-chat-response-text">{response}</div>
            <button
              className="inline-ai-chat-apply"
              onClick={() => onApplySuggestion(response)}
            >
              Apply
            </button>
          </div>
        )}

        <div className="inline-ai-chat-input-container">
          <textarea
            className="inline-ai-chat-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to help with this code..."
            rows={3}
            disabled={isLoading}
          />
          <button
            className="inline-ai-chat-send"
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
            title="Send"
          >
            <IconSend />
          </button>
        </div>

        <div className="inline-ai-chat-footer">
          <span className="inline-ai-chat-shortcut">
            Press Enter to send, Escape to close
          </span>
        </div>
      </div>
    </div>
  );
}

// Hook to manage inline AI chat state
export function useInlineAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ line: number; character: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string | undefined>();

  const openChat = (pos: { line: number; character: number }, text?: string) => {
    setPosition(pos);
    setSelectedText(text);
    setIsOpen(true);
  };

  const closeChat = () => {
    setIsOpen(false);
    setPosition(null);
    setSelectedText(undefined);
  };

  const sendMessage = async (
    message: string,
    context?: { selectedText?: string; position?: { line: number; character: number } }
  ): Promise<string> => {
    // In real implementation, this would call the AI backend
    console.log("Inline AI chat message:", message, context);
    return "AI response would appear here";
  };

  const applySuggestion = (suggestion: string) => {
    // In real implementation, this would apply the suggestion to the editor
    console.log("Apply suggestion:", suggestion);
  };

  return {
    isOpen,
    position,
    selectedText,
    openChat,
    closeChat,
    sendMessage,
    applySuggestion,
  };
}
