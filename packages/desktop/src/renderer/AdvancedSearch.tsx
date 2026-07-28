import { useState, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconSearch,
  IconX,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconFolder,
  IconFile,
} from "./Icons";

export interface SearchResult {
  filePath: string;
  matches: Array<{
    line: number;
    column: number;
    text: string;
    context: string;
  }>;
}

interface AdvancedSearchProps {
  onSearch: (query: string, options: SearchOptions) => Promise<SearchResult[]>;
  onReplace: (filePath: string, oldText: string, newText: string) => Promise<void>;
  onReplaceAll: (query: string, newText: string) => Promise<void>;
  onOpenFile: (filePath: string, line: number) => void;
  cwd?: string;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  includeGlob: string;
  excludeGlob: string;
}

export function AdvancedSearch({
  onSearch,
  onReplace,
  onReplaceAll,
  onOpenFile,
  cwd,
}: AdvancedSearchProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    includeGlob: "**/*",
    excludeGlob: "**/node_modules/**",
  });
  const [showReplace, setShowReplace] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const searchResults = await onSearch(query, options);
      setResults(searchResults);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleReplace = async (filePath: string, matchIndex: number) => {
    const fileResult = results.find((r) => r.filePath === filePath);
    if (!fileResult) return;

    const match = fileResult.matches[matchIndex];
    if (!match) return;

    await onReplace(filePath, match.text, replaceText);
    
    // Refresh results
    await handleSearch();
  };

  const handleReplaceAll = async () => {
    if (!query.trim()) return;
    await onReplaceAll(query, replaceText);
    await handleSearch();
  };

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
  const filesWithMatches = results.length;

  return (
    <div className="advanced-search">
      <div className="advanced-search-header" onClick={() => setExpanded(!expanded)}>
        <div className="advanced-search-title">
          <span className="advanced-search-icon">
            <IconSearch />
          </span>
          <span>Search & Replace</span>
          {totalMatches > 0 && (
            <span className="advanced-search-stats">
              {totalMatches} matches in {filesWithMatches} files
            </span>
          )}
        </div>
        <div className="advanced-search-actions">
          <span className="advanced-search-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="advanced-search-body">
          <div className="advanced-search-inputs">
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                className="search-input"
              />
              <button
                className="search-btn primary"
                onClick={handleSearch}
                disabled={isSearching}
              >
                <IconSearch />
                Search
              </button>
            </div>
            <button
              className="search-toggle-replace"
              onClick={() => setShowReplace(!showReplace)}
            >
              <IconEdit />
              {showReplace ? "Hide Replace" : "Show Replace"}
            </button>
            {showReplace && (
              <div className="search-input-group">
                <input
                  type="text"
                  placeholder="Replace with..."
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  className="search-input"
                />
                <button
                  className="search-btn"
                  onClick={handleReplaceAll}
                  disabled={totalMatches === 0}
                >
                  Replace All
                </button>
              </div>
            )}
          </div>

          <div className="search-options">
            <label className="search-option">
              <input
                type="checkbox"
                checked={options.caseSensitive}
                onChange={(e) =>
                  setOptions({ ...options, caseSensitive: e.target.checked })
                }
              />
              Case Sensitive
            </label>
            <label className="search-option">
              <input
                type="checkbox"
                checked={options.wholeWord}
                onChange={(e) =>
                  setOptions({ ...options, wholeWord: e.target.checked })
                }
              />
              Whole Word
            </label>
            <label className="search-option">
              <input
                type="checkbox"
                checked={options.regex}
                onChange={(e) =>
                  setOptions({ ...options, regex: e.target.checked })
                }
              />
              Regex
            </label>
            <div className="search-option-group">
              <label>Include:</label>
              <input
                type="text"
                value={options.includeGlob}
                onChange={(e) =>
                  setOptions({ ...options, includeGlob: e.target.value })
                }
                className="search-glob-input"
              />
            </div>
            <div className="search-option-group">
              <label>Exclude:</label>
              <input
                type="text"
                value={options.excludeGlob}
                onChange={(e) =>
                  setOptions({ ...options, excludeGlob: e.target.value })
                }
                className="search-glob-input"
              />
            </div>
          </div>

          {isSearching ? (
            <div className="search-loading">Searching...</div>
          ) : results.length === 0 && query ? (
            <div className="search-empty">
              <p>No results found</p>
              <p className="muted">Try adjusting your search options</p>
            </div>
          ) : results.length > 0 ? (
            <div className="search-results">
              {results.map((result) => (
                <div key={result.filePath} className="search-result-file">
                  <div className="search-result-header">
                    <span className="search-result-icon">
                      <IconFile />
                    </span>
                    <span className="search-result-path">
                      {result.filePath}
                    </span>
                    <span className="search-result-count">
                      {result.matches.length} matches
                    </span>
                  </div>
                  <div className="search-result-matches">
                    {result.matches.map((match, index) => (
                      <div
                        key={index}
                        className="search-match"
                        onClick={() => onOpenFile(result.filePath, match.line)}
                      >
                        <div className="search-match-location">
                          Line {match.line + 1}:{match.column + 1}
                        </div>
                        <div className="search-match-context">
                          {match.context}
                        </div>
                        {showReplace && (
                          <button
                            className="search-match-replace"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplace(result.filePath, index);
                            }}
                          >
                            Replace
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Hook to manage advanced search state
export function useAdvancedSearch(cwd?: string) {
  const [results, setResults] = useState<SearchResult[]>([]);

  const search = async (
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> => {
    if (!cwd) return [];

    // In real implementation, this would use the file system to search
    // For now, return empty results
    return [];
  };

  const replace = async (filePath: string, oldText: string, newText: string) => {
    const result = await window.api?.readFile(filePath);
    if (result && !("error" in result)) {
      const content = result.content.replace(oldText, newText);
      await window.api?.writeFile(filePath, content);
    }
  };

  const replaceAll = async (query: string, newText: string) => {
    for (const result of results) {
      for (const match of result.matches) {
        await replace(result.filePath, match.text, newText);
      }
    }
  };

  return {
    results,
    search,
    replace,
    replaceAll,
  };
}
