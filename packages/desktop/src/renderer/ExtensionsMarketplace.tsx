import { useState, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconPlus,
  IconX,
  IconChevronDown,
  IconChevronRight,
  IconSearch,
  IconDownload,
  IconSettings,
} from "./Icons";

export interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  downloads: number;
  rating: number;
  icon?: string;
  installed: boolean;
  enabled: boolean;
  category: string;
}

interface ExtensionsMarketplaceProps {
  extensions: Extension[];
  onInstall: (id: string) => Promise<void>;
  onUninstall: (id: string) => Promise<void>;
  onEnable: (id: string) => Promise<void>;
  onDisable: (id: string) => Promise<void>;
  onSearch: (query: string) => Promise<Extension[]>;
  categories: string[];
}

export function ExtensionsMarketplace({
  extensions,
  onInstall,
  onUninstall,
  onEnable,
  onDisable,
  onSearch,
  categories,
}: ExtensionsMarketplaceProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"marketplace" | "installed">("marketplace");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);

  const filteredExtensions = extensions.filter((ext) => {
    const matchesSearch =
      ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ext.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || ext.category === selectedCategory;
    const matchesTab =
      activeTab === "installed" ? ext.installed : true;
    return matchesSearch && matchesCategory && matchesTab;
  });

  const handleInstall = async (id: string) => {
    await onInstall(id);
  };

  const handleUninstall = async (id: string) => {
    await onUninstall(id);
  };

  const handleToggleEnable = async (extension: Extension) => {
    if (extension.enabled) {
      await onDisable(extension.id);
    } else {
      await onEnable(extension.id);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await onSearch(searchQuery.trim());
    }
  };

  return (
    <div className="extensions-marketplace">
      <div className="extensions-header" onClick={() => setExpanded(!expanded)}>
        <div className="extensions-title">
          <span className="extensions-icon">🧩</span>
          <span>Extensions</span>
          {extensions.filter((e) => e.installed).length > 0 && (
            <span className="extensions-count">
              {extensions.filter((e) => e.installed).length} installed
            </span>
          )}
        </div>
        <div className="extensions-actions">
          <span className="extensions-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="extensions-body">
          <div className="extensions-tabs">
            <button
              className={`extensions-tab ${activeTab === "marketplace" ? "active" : ""}`}
              onClick={() => setActiveTab("marketplace")}
            >
              Marketplace
            </button>
            <button
              className={`extensions-tab ${activeTab === "installed" ? "active" : ""}`}
              onClick={() => setActiveTab("installed")}
            >
              Installed ({extensions.filter((e) => e.installed).length})
            </button>
          </div>

          <div className="extensions-search">
            <IconSearch />
            <input
              type="text"
              placeholder="Search extensions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              className="extensions-search-input"
            />
          </div>

          <div className="extensions-categories">
            <button
              className={`extensions-category ${selectedCategory === "all" ? "active" : ""}`}
              onClick={() => setSelectedCategory("all")}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                className={`extensions-category ${selectedCategory === category ? "active" : ""}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="extensions-content">
            {filteredExtensions.length === 0 ? (
              <div className="extensions-empty">
                <p>No extensions found</p>
                <p className="muted">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="extensions-list">
                {filteredExtensions.map((extension) => (
                  <div key={extension.id} className="extension-item">
                    <div className="extension-item-main">
                      <div className="extension-icon">
                        {extension.icon || "📦"}
                      </div>
                      <div className="extension-info">
                        <div className="extension-header">
                          <span className="extension-name">{extension.name}</span>
                          <span className="extension-version">v{extension.version}</span>
                        </div>
                        <div className="extension-description">
                          {extension.description}
                        </div>
                        <div className="extension-meta">
                          <span className="extension-author">by {extension.author}</span>
                          <span className="extension-downloads">
                            {extension.downloads.toLocaleString()} downloads
                          </span>
                          <span className="extension-rating">
                            ⭐ {extension.rating}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="extension-item-actions">
                      {extension.installed ? (
                        <>
                          <button
                            className={`extension-btn ${extension.enabled ? "danger" : "primary"}`}
                            onClick={() => handleToggleEnable(extension)}
                          >
                            {extension.enabled ? "Disable" : "Enable"}
                          </button>
                          <button
                            className="extension-btn danger"
                            onClick={() => handleUninstall(extension.id)}
                          >
                            <IconX />
                          </button>
                        </>
                      ) : (
                        <button
                          className="extension-btn primary"
                          onClick={() => handleInstall(extension.id)}
                        >
                          <IconDownload />
                          Install
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Hook to manage extensions marketplace state
export function useExtensionsMarketplace() {
  const [extensions, setExtensions] = useState<Extension[]>([
    {
      id: "prettier",
      name: "Prettier",
      description: "Code formatter using prettier",
      author: "Prettier",
      version: "3.0.0",
      downloads: 15000000,
      rating: 4.8,
      icon: "✨",
      installed: false,
      enabled: false,
      category: "Formatter",
    },
    {
      id: "eslint",
      name: "ESLint",
      description: "Integrates ESLint JavaScript into VS Code",
      author: "Microsoft",
      version: "2.4.0",
      downloads: 25000000,
      rating: 4.7,
      icon: "🔍",
      installed: false,
      enabled: false,
      category: "Linter",
    },
    {
      id: "gitlens",
      name: "GitLens",
      description: "Supercharge Git within VS Code",
      author: "GitKraken",
      version: "14.0.0",
      downloads: 20000000,
      rating: 4.9,
      icon: "📦",
      installed: false,
      enabled: false,
      category: "Git",
    },
  ]);

  const [categories] = useState<string[]>(["Formatter", "Linter", "Git", "Theme", "Language"]);

  const install = async (id: string) => {
    setExtensions((prev) =>
      prev.map((ext) =>
        ext.id === id ? { ...ext, installed: true, enabled: true } : ext
      )
    );
  };

  const uninstall = async (id: string) => {
    setExtensions((prev) =>
      prev.map((ext) =>
        ext.id === id ? { ...ext, installed: false, enabled: false } : ext
      )
    );
  };

  const enable = async (id: string) => {
    setExtensions((prev) =>
      prev.map((ext) => (ext.id === id ? { ...ext, enabled: true } : ext))
    );
  };

  const disable = async (id: string) => {
    setExtensions((prev) =>
      prev.map((ext) => (ext.id === id ? { ...ext, enabled: false } : ext))
    );
  };

  const search = async (query: string): Promise<Extension[]> => {
    // In real implementation, this would search the marketplace
    console.log("Search extensions:", query);
    return extensions;
  };

  return {
    extensions,
    categories,
    install,
    uninstall,
    enable,
    disable,
    search,
  };
}
