import { useState } from "react";
import { TerminalPane } from "./TerminalPane";
import { TerminalGrid } from "./TerminalGrid";

export function TerminalDeck({
  cwd,
  hidden,
  themeKey,
}: {
  cwd: string | null;
  hidden: boolean;
  themeKey: string;
}) {
  const [terminals, setTerminals] = useState<number[]>([1]);
  const [activeId, setActiveId] = useState(1);
  const [nextId, setNextId] = useState(2);
  const [layout, setLayout] = useState<"tabs" | "grid">(
    () => (localStorage.getItem("tc-term-layout") === "grid" ? "grid" : "tabs"),
  );
  const toggleLayout = () => {
    setLayout((prev) => {
      const next = prev === "grid" ? "tabs" : "grid";
      localStorage.setItem("tc-term-layout", next);
      return next;
    });
  };

  const addTerminal = () => {
    const id = nextId;
    setTerminals((prev) => [...prev, id]);
    setActiveId(id);
    setNextId(id + 1);
  };

  const closeTerminal = (id: number) => {
    setTerminals((prev) => {
      const rest = prev.filter((t) => t !== id);
      if (rest.length === 0) {
        const fresh = nextId;
        setNextId(fresh + 1);
        setActiveId(fresh);
        return [fresh];
      }
      if (activeId === id) setActiveId(rest[rest.length - 1]!);
      return rest;
    });
  };

  const renderPane = (id: number) => (
    <TerminalPane
      id={id}
      cwd={cwd}
      hidden={layout === "grid" ? hidden : hidden || id !== activeId}
      themeKey={themeKey}
    />
  );

  return (
    <div className={`term-deck ${hidden ? "hidden" : ""}`}>
      <div className="term-tabs">
        {terminals.map((id, i) => (
          <div key={id} className={`term-tab ${id === activeId ? "active" : ""}`}>
            <button className="term-tab-label" onClick={() => setActiveId(id)}>
              Terminal {i + 1}
            </button>
            <button
              className="term-tab-close"
              title="Close terminal"
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button className="term-tab-add" title="New terminal" onClick={addTerminal}>
          +
        </button>
        <button
          className="term-tab-add"
          title={layout === "grid" ? "Tabs view" : "Grid view"}
          onClick={toggleLayout}
        >
          {layout === "grid" ? "▭" : "▦"}
        </button>
      </div>
      {layout === "grid" ? (
        <TerminalGrid
          terminals={terminals}
          activeId={activeId}
          onActivate={setActiveId}
          renderPane={renderPane}
        />
      ) : (
        <div className="term-deck-body">
          {terminals.map((id) => (
            <div key={id} className="term-pane-cell">
              {renderPane(id)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
