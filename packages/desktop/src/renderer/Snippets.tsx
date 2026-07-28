import { useState, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconPlus,
  IconX,
  IconEdit,
  IconSearch,
  IconChevronDown,
  IconChevronRight,
} from "./Icons";

export interface Snippet {
  id: string;
  name: string;
  prefix: string;
  description?: string;
  body: string;
  language: string;
}

interface SnippetsPanelProps {
  snippets: Snippet[];
  onAddSnippet: (snippet: Omit<Snippet, "id">) => void;
  onEditSnippet: (id: string, snippet: Partial<Snippet>) => void;
  onDeleteSnippet: (id: string) => void;
  onInsertSnippet: (snippet: Snippet) => void;
  currentLanguage?: string;
}

export function SnippetsPanel({
  snippets,
  onAddSnippet,
  onEditSnippet,
  onDeleteSnippet,
  onInsertSnippet,
  currentLanguage,
}: SnippetsPanelProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    prefix: "",
    description: "",
    body: "",
    language: currentLanguage || "javascript",
  });

  const filteredSnippets = snippets.filter(
    (s) =>
      (s.language === currentLanguage || !currentLanguage) &&
      (s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.prefix.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false))
  );

  const handleAddSnippet = () => {
    if (formData.name && formData.prefix && formData.body) {
      onAddSnippet({
        name: formData.name,
        prefix: formData.prefix,
        description: formData.description,
        body: formData.body,
        language: formData.language,
      });
      setFormData({
        name: "",
        prefix: "",
        description: "",
        body: "",
        language: currentLanguage || "javascript",
      });
      setShowAddForm(false);
    }
  };

  const handleEditSnippet = () => {
    if (editingSnippet && formData.name && formData.prefix && formData.body) {
      onEditSnippet(editingSnippet, formData);
      setEditingSnippet(null);
      setFormData({
        name: "",
        prefix: "",
        description: "",
        body: "",
        language: currentLanguage || "javascript",
      });
    }
  };

  const startEdit = (snippet: Snippet) => {
    setEditingSnippet(snippet.id);
    setFormData({
      name: snippet.name,
      prefix: snippet.prefix,
      description: snippet.description || "",
      body: snippet.body,
      language: snippet.language,
    });
    setShowAddForm(true);
  };

  return (
    <div className="snippets-panel">
      <div className="snippets-header" onClick={() => setExpanded(!expanded)}>
        <div className="snippets-title">
          <span className="snippets-icon">📝</span>
          <span>Snippets</span>
          <span className="snippets-count">{filteredSnippets.length}</span>
        </div>
        <div className="snippets-actions">
          <button
            className="snippets-btn"
            title="Add Snippet"
            onClick={(e) => {
              e.stopPropagation();
              setShowAddForm(true);
              setEditingSnippet(null);
              setFormData({
                name: "",
                prefix: "",
                description: "",
                body: "",
                language: currentLanguage || "javascript",
              });
            }}
          >
            <IconPlus />
          </button>
          <span className="snippets-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="snippets-body">
          {showAddForm && (
            <div className="snippets-form">
              <input
                type="text"
                placeholder="Snippet name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="snippets-input"
              />
              <input
                type="text"
                placeholder="Prefix (trigger)"
                value={formData.prefix}
                onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                className="snippets-input"
              />
              <input
                type="text"
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="snippets-input"
              />
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="snippets-select"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="json">JSON</option>
              </select>
              <textarea
                placeholder="Snippet body (use $1, $2 for placeholders)"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="snippets-textarea"
                rows={6}
              />
              <div className="snippets-form-actions">
                <button
                  className="snippets-btn"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingSnippet(null);
                    setFormData({
                      name: "",
                      prefix: "",
                      description: "",
                      body: "",
                      language: currentLanguage || "javascript",
                    });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="snippets-btn primary"
                  onClick={editingSnippet ? handleEditSnippet : handleAddSnippet}
                >
                  {editingSnippet ? "Update" : "Add"}
                </button>
              </div>
            </div>
          )}

          <div className="snippets-search">
            <IconSearch />
            <input
              type="text"
              placeholder="Search snippets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="snippets-search-input"
            />
          </div>

          {filteredSnippets.length === 0 ? (
            <div className="snippets-empty">
              <p>No snippets found</p>
              <p className="muted">Create snippets to speed up your coding</p>
            </div>
          ) : (
            <div className="snippets-list">
              {filteredSnippets.map((snippet) => (
                <div key={snippet.id} className="snippet-item">
                  <div className="snippet-item-main">
                    <div className="snippet-info">
                      <div className="snippet-name">{snippet.name}</div>
                      <div className="snippet-prefix">
                        <code>{snippet.prefix}</code>
                      </div>
                      {snippet.description && (
                        <div className="snippet-description">
                          {snippet.description}
                        </div>
                      )}
                      <div className="snippet-language">
                        {snippet.language}
                      </div>
                    </div>
                  </div>
                  <div className="snippet-item-actions">
                    <button
                      className="snippet-item-btn"
                      title="Insert"
                      onClick={() => onInsertSnippet(snippet)}
                    >
                      <IconChevronRight />
                    </button>
                    <button
                      className="snippet-item-btn"
                      title="Edit"
                      onClick={() => startEdit(snippet)}
                    >
                      <IconEdit />
                    </button>
                    <button
                      className="snippet-item-btn danger"
                      title="Delete"
                      onClick={() => onDeleteSnippet(snippet.id)}
                    >
                      <IconX />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook to manage snippets state
export function useSnippets() {
  const [snippets, setSnippets] = useState<Snippet[]>([
    {
      id: "1",
      name: "React Component",
      prefix: "rc",
      description: "Create a React functional component",
      body: "import React from 'react';\n\ninterface $1Props {\n  $2\n}\n\nexport const $1: React.FC<$1Props> = ({ $2 }) => {\n  return (\n    <div>\n      $0\n    </div>\n  );\n};",
      language: "typescript",
    },
    {
      id: "2",
      name: "Python Function",
      prefix: "def",
      description: "Create a Python function",
      body: "def $1($2):\n    \"\"\"\n    $3\n    \"\"\"\n    $0",
      language: "python",
    },
  ]);

  const addSnippet = (snippet: Omit<Snippet, "id">) => {
    setSnippets((prev) => [
      ...prev,
      { ...snippet, id: `snippet-${Date.now()}` },
    ]);
  };

  const editSnippet = (id: string, updates: Partial<Snippet>) => {
    setSnippets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const deleteSnippet = (id: string) => {
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  };

  const insertSnippet = (snippet: Snippet) => {
    // In real implementation, this would insert the snippet into the editor
    console.log("Insert snippet:", snippet);
  };

  return {
    snippets,
    addSnippet,
    editSnippet,
    deleteSnippet,
    insertSnippet,
  };
}
