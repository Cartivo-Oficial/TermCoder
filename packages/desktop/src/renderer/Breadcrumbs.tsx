import { useState, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconChevronRight,
  IconFolder,
  IconFile,
} from "./Icons";

export interface BreadcrumbItem {
  name: string;
  path: string;
  type: "folder" | "file";
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onItemClick: (item: BreadcrumbItem) => void;
  showRoot?: boolean;
}

export function Breadcrumbs({ items, onItemClick, showRoot = false }: BreadcrumbsProps) {
  const { t } = useI18n();

  if (items.length === 0) return null;

  const displayItems = showRoot ? items : items.slice(1);

  return (
    <div className="breadcrumbs">
      {displayItems.map((item, index) => (
        <div key={item.path} className="breadcrumb-item">
          <button
            className="breadcrumb-button"
            onClick={() => onItemClick(item)}
            title={item.path}
          >
            {item.type === "folder" && (
              <span className="breadcrumb-icon">
                <IconFolder />
              </span>
            )}
            {item.type === "file" && (
              <span className="breadcrumb-icon">
                <IconFile />
              </span>
            )}
            <span className="breadcrumb-text">{item.name}</span>
          </button>
          {index < displayItems.length - 1 && (
            <span className="breadcrumb-separator">
              <IconChevronRight />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// Hook to manage breadcrumbs state
export function useBreadcrumbs(filePath?: string) {
  const [items, setItems] = useState<BreadcrumbItem[]>([]);

  useEffect(() => {
    if (!filePath) {
      setItems([]);
      return;
    }

    const parts = filePath.split("/").filter(Boolean);
    const breadcrumbItems: BreadcrumbItem[] = [];

    let currentPath = "";
    parts.forEach((part, index) => {
      currentPath += (currentPath ? "/" : "") + part;
      const isFile = index === parts.length - 1;
      breadcrumbItems.push({
        name: part,
        path: currentPath,
        type: isFile ? "file" : "folder",
      });
    });

    setItems(breadcrumbItems);
  }, [filePath]);

  const handleItemClick = (item: BreadcrumbItem) => {
    // In real implementation, this would navigate to the folder or file
    console.log("Navigate to:", item.path);
  };

  return {
    items,
    handleItemClick,
  };
}
