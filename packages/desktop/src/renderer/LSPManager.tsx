import { useEffect, useRef, useState } from "react";

export interface LSPCompletion {
  label: string;
  kind: string;
  detail?: string;
  documentation?: string;
  sortText?: string;
  insertText: string;
}

export interface LSPDiagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  severity: number;
  message: string;
  source?: string;
  code?: string;
}

export interface LSPPosition {
  line: number;
  character: number;
}

export class LSPManager {
  private servers: Map<string, any> = new Map();
  private completionsCache: Map<string, LSPCompletion[]> = new Map();
  private diagnosticsCache: Map<string, LSPDiagnostic[]> = new Map();

  // Simple language detection
  private getLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      py: "python",
      go: "go",
      rs: "rust",
      java: "java",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      php: "php",
      rb: "ruby",
    };
    return langMap[ext] || "text";
  }

  // Get completions for a file at position
  async getCompletions(
    filePath: string,
    content: string,
    position: LSPPosition
  ): Promise<LSPCompletion[]> {
    const language = this.getLanguage(filePath);
    const cacheKey = `${filePath}:${position.line}:${position.character}`;
    
    // Check cache first
    if (this.completionsCache.has(cacheKey)) {
      return this.completionsCache.get(cacheKey)!;
    }

    // Generate completions based on language and context
    const completions = this.generateCompletions(language, content, position);
    
    // Cache for 5 minutes
    this.completionsCache.set(cacheKey, completions);
    setTimeout(() => this.completionsCache.delete(cacheKey), 5 * 60 * 1000);
    
    return completions;
  }

  private generateCompletions(
    language: string,
    content: string,
    position: LSPPosition
  ): LSPCompletion[] {
    const completions: LSPCompletion[] = [];
    const lines = content.split("\n");
    const currentLine = lines[position.line] || "";
    const beforeCursor = currentLine.slice(0, position.character);
    
    // Extract the word being typed
    const wordMatch = beforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
    const prefix = wordMatch?.[1] || "";

    // Language-specific completions
    if (language === "typescript" || language === "javascript") {
      completions.push(...this.getJSCompletions(prefix || "", content, position));
    } else if (language === "python") {
      completions.push(...this.getPythonCompletions(prefix || "", content, position));
    } else if (language === "go") {
      completions.push(...this.getGoCompletions(prefix || "", content, position));
    }

    // Common keywords
    const keywords = this.getKeywords(language);
    for (const keyword of keywords) {
      if (keyword.startsWith(prefix || "") && keyword !== prefix) {
        completions.push({
          label: keyword,
          kind: "Keyword",
          insertText: keyword,
        });
      }
    }

    // Sort by relevance
    return completions.sort((a, b) => {
      const aStartsWith = a.label.startsWith(prefix);
      const bStartsWith = b.label.startsWith(prefix);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.label.localeCompare(b.label);
    }).slice(0, 20); // Limit to 20 completions
  }

  private getJSCompletions(prefix: string, content: string, position: LSPPosition): LSPCompletion[] {
    const completions: LSPCompletion[] = [];
    
    // Common JS/TS patterns
    const patterns = [
      { label: "console.log", kind: "Function", insertText: "console.log($1)" },
      { label: "console.error", kind: "Function", insertText: "console.error($1)" },
      { label: "console.warn", kind: "Function", insertText: "console.warn($1)" },
      { label: "useState", kind: "Function", insertText: "useState($1)" },
      { label: "useEffect", kind: "Function", insertText: "useEffect(() => {\n  $1\n}, [])" },
      { label: "useRef", kind: "Function", insertText: "useRef($1)" },
      { label: "useCallback", kind: "Function", insertText: "useCallback(() => {\n  $1\n}, [])" },
      { label: "useMemo", kind: "Function", insertText: "useMemo(() => $1, [])" },
      { label: "interface", kind: "Keyword", insertText: "interface $1 {\n  $2\n}" },
      { label: "type", kind: "Keyword", insertText: "type $1 = $2" },
      { label: "import", kind: "Keyword", insertText: 'import { $1 } from "$2"' },
      { label: "export", kind: "Keyword", insertText: "export $1" },
      { label: "async", kind: "Keyword", insertText: "async " },
      { label: "await", kind: "Keyword", insertText: "await " },
      { label: "Promise", kind: "Class", insertText: "Promise" },
      { label: "Map", kind: "Class", insertText: "Map" },
      { label: "Set", kind: "Class", insertText: "Set" },
      { label: "Array", kind: "Class", insertText: "Array" },
      { label: "Object", kind: "Class", insertText: "Object" },
      { label: "string", kind: "Class", insertText: "string" },
      { label: "number", kind: "Class", insertText: "number" },
      { label: "boolean", kind: "Class", insertText: "boolean" },
      { label: "void", kind: "Class", insertText: "void" },
      { label: "any", kind: "Class", insertText: "any" },
      { label: "null", kind: "Class", insertText: "null" },
      { label: "undefined", kind: "Class", insertText: "undefined" },
    ];

    for (const pattern of patterns) {
      if (pattern.label.startsWith(prefix)) {
        completions.push(pattern);
      }
    }

    // Extract variable/function names from the file
    const variableRegex = /(?:const|let|var|function|interface|type|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;
    const seen = new Set();
    while ((match = variableRegex.exec(content)) !== null) {
      const name = match[1];
      if (name && name.startsWith(prefix || "") && !seen.has(name)) {
        seen.add(name);
        completions.push({
          label: name,
          kind: "Variable",
          insertText: name,
        });
      }
    }

    return completions;
  }

  private getPythonCompletions(prefix: string, content: string, position: LSPPosition): LSPCompletion[] {
    const completions: LSPCompletion[] = [];
    
    const patterns = [
      { label: "def", kind: "Keyword", insertText: "def $1($2):\n    $3" },
      { label: "class", kind: "Keyword", insertText: "class $1:\n    def __init__(self):\n        $2" },
      { label: "import", kind: "Keyword", insertText: "import $1" },
      { label: "from", kind: "Keyword", insertText: "from $1 import $2" },
      { label: "print", kind: "Function", insertText: "print($1)" },
      { label: "len", kind: "Function", insertText: "len($1)" },
      { label: "range", kind: "Function", insertText: "range($1)" },
      { label: "str", kind: "Function", insertText: "str($1)" },
      { label: "int", kind: "Function", insertText: "int($1)" },
      { label: "float", kind: "Function", insertText: "float($1)" },
      { label: "list", kind: "Function", insertText: "list($1)" },
      { label: "dict", kind: "Function", insertText: "dict($1)" },
      { label: "set", kind: "Function", insertText: "set($1)" },
      { label: "tuple", kind: "Function", insertText: "tuple($1)" },
      { label: "self", kind: "Variable", insertText: "self" },
      { label: "True", kind: "Constant", insertText: "True" },
      { label: "False", kind: "Constant", insertText: "False" },
      { label: "None", kind: "Constant", insertText: "None" },
    ];

    for (const pattern of patterns) {
      if (pattern.label.startsWith(prefix)) {
        completions.push(pattern);
      }
    }

    return completions;
  }

  private getGoCompletions(prefix: string, content: string, position: LSPPosition): LSPCompletion[] {
    const completions: LSPCompletion[] = [];
    
    const patterns = [
      { label: "func", kind: "Keyword", insertText: "func $1($2) $3 {\n\t$4\n}" },
      { label: "package", kind: "Keyword", insertText: "package $1" },
      { label: "import", kind: "Keyword", insertText: "import \"$1\"" },
      { label: "struct", kind: "Keyword", insertText: "type $1 struct {\n\t$2\n}" },
      { label: "interface", kind: "Keyword", insertText: "type $1 interface {\n\t$2\n}" },
      { label: "go", kind: "Keyword", insertText: "go $1()" },
      { label: "chan", kind: "Keyword", insertText: "chan $1" },
      { label: "defer", kind: "Keyword", insertText: "defer $1()" },
      { label: "return", kind: "Keyword", insertText: "return $1" },
      { label: "fmt.Println", kind: "Function", insertText: "fmt.Println($1)" },
      { label: "fmt.Printf", kind: "Function", insertText: "fmt.Printf(\"$1\", $2)" },
      { label: "make", kind: "Function", insertText: "make($1)" },
      { label: "new", kind: "Function", insertText: "new($1)" },
      { label: "append", kind: "Function", insertText: "append($1, $2)" },
      { label: "copy", kind: "Function", insertText: "copy($1, $2)" },
      { label: "len", kind: "Function", insertText: "len($1)" },
      { label: "cap", kind: "Function", insertText: "cap($1)" },
    ];

    for (const pattern of patterns) {
      if (pattern.label.startsWith(prefix)) {
        completions.push(pattern);
      }
    }

    return completions;
  }

  private getKeywords(language: string): string[] {
    const keywordMap: Record<string, string[]> = {
      typescript: [
        "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete",
        "do", "else", "export", "extends", "false", "finally", "for", "function", "if", "import",
        "in", "instanceof", "new", "null", "return", "super", "switch", "this", "throw", "true",
        "try", "typeof", "var", "void", "while", "with", "as", "implements", "interface", "let",
        "package", "private", "protected", "public", "static", "yield", "enum", "type", "abstract",
      ],
      javascript: [
        "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete",
        "do", "else", "export", "extends", "false", "finally", "for", "function", "if", "import",
        "in", "instanceof", "new", "null", "return", "super", "switch", "this", "throw", "true",
        "try", "typeof", "var", "void", "while", "with", "yield", "async", "await",
      ],
      python: [
        "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class",
        "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
        "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
        "try", "while", "with", "yield",
      ],
      go: [
        "break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough",
        "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range",
        "return", "select", "struct", "switch", "type", "var",
      ],
    };
    return keywordMap[language] || [];
  }

  // Get diagnostics for a file
  async getDiagnostics(filePath: string, content: string): Promise<LSPDiagnostic[]> {
    const language = this.getLanguage(filePath);
    
    // Check cache
    if (this.diagnosticsCache.has(filePath)) {
      return this.diagnosticsCache.get(filePath)!;
    }

    const diagnostics = this.generateDiagnostics(language, content);
    
    // Cache for 1 minute
    this.diagnosticsCache.set(filePath, diagnostics);
    setTimeout(() => this.diagnosticsCache.delete(filePath), 60 * 1000);
    
    return diagnostics;
  }

  private generateDiagnostics(language: string, content: string): LSPDiagnostic[] {
    const diagnostics: LSPDiagnostic[] = [];
    const lines = content.split("\n");

    // Basic syntax checking
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || "";
      
      // Check for unmatched brackets
      const openBrackets = (line.match(/\{/g) || []).length;
      const closeBrackets = (line.match(/\}/g) || []).length;
      if (openBrackets !== closeBrackets) {
        diagnostics.push({
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          severity: 2, // Warning
          message: "Unmatched brackets",
          source: "lsp",
        });
      }

      // Check for unmatched parentheses
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        diagnostics.push({
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          severity: 2,
          message: "Unmatched parentheses",
          source: "lsp",
        });
      }

      // Check for trailing whitespace
      if (line.endsWith(" ") || line.endsWith("\t")) {
        diagnostics.push({
          range: {
            start: { line: i, character: line.trimEnd().length },
            end: { line: i, character: line.length },
          },
          severity: 1, // Error
          message: "Trailing whitespace",
          source: "lsp",
        });
      }
    }

    return diagnostics;
  }

  // Go to definition
  async goToDefinition(
    filePath: string,
    content: string,
    position: LSPPosition
  ): Promise<{ filePath: string; position: LSPPosition } | null> {
    // Simple implementation: search for the word under cursor in the file
    const lines = content.split("\n");
    const line = lines[position.line] || "";
    const wordMatch = line.match(/([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (!wordMatch) return null;

    const word = wordMatch.find(w => line.indexOf(w) <= position.character && line.indexOf(w) + w.length >= position.character);
    if (!word) return null;

    // Search for definition (const, let, var, function, def, etc)
    const definitionRegex = new RegExp(`(?:const|let|var|function|def|class|interface|type|struct)\\s+${word}`, "g");
    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i] || "";
      if (definitionRegex.test(currentLine)) {
        return {
          filePath,
          position: { line: i, character: currentLine.indexOf(word) },
        };
      }
    }

    return null;
  }

  // Clear cache for a file
  clearCache(filePath: string) {
    this.completionsCache.forEach((_, key) => {
      if (key.startsWith(filePath)) {
        this.completionsCache.delete(key);
      }
    });
    this.diagnosticsCache.delete(filePath);
  }

  // Shutdown
  shutdown() {
    this.servers.clear();
    this.completionsCache.clear();
    this.diagnosticsCache.clear();
  }
}

// Hook to use LSP manager
export function useLSP() {
  const lspRef = useRef<LSPManager | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    lspRef.current = new LSPManager();
    setReady(true);

    return () => {
      lspRef.current?.shutdown();
    };
  }, []);

  return {
    lsp: lspRef.current,
    ready,
  };
}
