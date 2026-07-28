import { useMemo } from "react";
import type { IDEMessage } from "./IDELayout";

export interface ParsedFile {
  path: string;
  content?: string;
  language?: string;
  lineCount?: number;
}

export interface ParsedMessage {
  original: IDEMessage;
  files: ParsedFile[];
  text: string;
}

// Detect file read operations in tool messages
function parseToolMessage(message: IDEMessage): ParsedFile[] {
  const files: ParsedFile[] = [];
  
  if (message.role !== "tool" || !message.detail) return files;
  
  const detail = message.detail;
  
  // Detect read_file operations
  if (message.name === "read_file" || detail.includes("read_file")) {
    const pathMatch = detail.match(/path["\s:]+([^\s"\n]+)/);
    if (pathMatch && pathMatch[1]) {
      const path = pathMatch[1].replace(/[\\"]/g, "");
      const contentMatch = detail.match(/content["\s:]+(["'])([\s\S]*?)\1/);
      const content = contentMatch && contentMatch[2] ? contentMatch[2] : undefined;
      
      files.push({
        path,
        content,
        language: getLanguageFromPath(path),
        lineCount: content ? content.split("\n").length : undefined,
      });
    }
  }
  
  // Detect grep_search results with file paths
  if (message.name === "grep_search" || detail.includes("grep_search")) {
    const pathMatches = detail.match(/([a-zA-Z]:\\[^:\n\r]+|\/[^:\n\r]+)/g);
    if (pathMatches) {
      for (const path of pathMatches) {
        if (!files.find(f => f.path === path)) {
          files.push({
            path: path.replace(/[\\"]/g, ""),
            language: getLanguageFromPath(path),
          });
        }
      }
    }
  }
  
  // Detect find_by_name results
  if (message.name === "find_by_name" || detail.includes("find_by_name")) {
    const pathMatches = detail.match(/([a-zA-Z]:\\[^:\n\r]+|\/[^:\n\r]+)/g);
    if (pathMatches) {
      for (const path of pathMatches) {
        if (!files.find(f => f.path === path)) {
          files.push({
            path: path.replace(/[\\"]/g, ""),
            language: getLanguageFromPath(path),
          });
        }
      }
    }
  }
  
  return files;
}

// Parse assistant messages for file references
function parseAssistantMessage(message: IDEMessage): ParsedFile[] {
  const files: ParsedFile[] = [];
  
  if (message.role !== "assistant" || !message.text) return files;
  
  // Look for file paths in markdown code blocks
  const codeBlockRegex = /```(\w+)?\n(?:\/\/|\/\*|#|<!--)?\s*([a-zA-Z]:\\[^:\n\r]+|\/[^:\n\r]+)[\s\S]*?```/g;
  let match;
  while ((match = codeBlockRegex.exec(message.text)) !== null) {
    const path = match[2]?.trim();
    if (path && !files.find(f => f.path === path)) {
      files.push({
        path,
        language: match[1] || getLanguageFromPath(path),
      });
    }
  }
  
  // Look for file paths in text like "src/components/App.tsx"
  const pathRegex = /(?:^|\s)([a-zA-Z]:\\[^:\s\n\r]+|\/[^:\s\n\r]+)(?:$|\s)/g;
  while ((match = pathRegex.exec(message.text)) !== null) {
    const path = match[1]?.trim();
    if (path && path.includes(".") && !files.find(f => f.path === path)) {
      files.push({
        path,
        language: getLanguageFromPath(path),
      });
    }
  }
  
  return files;
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    html: "html",
    css: "css",
    json: "json",
    md: "markdown",
    mdx: "markdown",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    sql: "sql",
    sh: "bash",
    ps1: "powershell",
    bat: "batch",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    go: "go",
    rs: "rust",
    php: "php",
    rb: "ruby",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
  };
  return langMap[ext || ""] || "text";
}

export function useMessageParser(messages: IDEMessage[]): ParsedMessage[] {
  return useMemo(() => {
    return messages.map((msg) => {
      let files: ParsedFile[] = [];
      
      if (msg.role === "tool") {
        files = parseToolMessage(msg);
      } else if (msg.role === "assistant") {
        files = parseAssistantMessage(msg);
      }
      
      return {
        original: msg,
        files,
        text: msg.text,
      };
    });
  }, [messages]);
}
