import { useState, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconPlay,
  IconStop,
  IconRefresh,
  IconPlus,
  IconX,
  IconChevronDown,
  IconChevronRight,
  IconTerminal,
} from "./Icons";

export interface Task {
  id: string;
  name: string;
  command: string;
  icon?: string;
  category?: "build" | "test" | "dev" | "lint" | "custom";
}

export interface TaskExecution {
  taskId: string;
  status: "running" | "success" | "error";
  output: string[];
  startTime: number;
  endTime?: number;
}

interface TaskRunnerProps {
  tasks: Task[];
  onRunTask: (taskId: string) => void;
  onStopTask: (taskId: string) => void;
  onAddTask: (task: Omit<Task, "id">) => void;
  onRemoveTask: (taskId: string) => void;
  executions: Map<string, TaskExecution>;
  cwd?: string;
}

export function TaskRunner({
  tasks,
  onRunTask,
  onStopTask,
  onAddTask,
  onRemoveTask,
  executions,
  cwd,
}: TaskRunnerProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskCommand, setNewTaskCommand] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<Task["category"]>("custom");

  const handleAddTask = () => {
    if (newTaskName.trim() && newTaskCommand.trim()) {
      onAddTask({
        name: newTaskName.trim(),
        command: newTaskCommand.trim(),
        category: newTaskCategory,
      });
      setNewTaskName("");
      setNewTaskCommand("");
      setShowAddTask(false);
    }
  };

  const getCategoryIcon = (category?: Task["category"]) => {
    const cat = category || "custom";
    const icons: Record<string, string> = {
      build: "🔨",
      test: "🧪",
      dev: "⚡",
      lint: "🔍",
      custom: "⚙️",
    };
    return icons[cat] || icons.custom;
  };

  const getCategoryColor = (category?: Task["category"]) => {
    const cat = category || "custom";
    const colors: Record<string, string> = {
      build: "var(--warn)",
      test: "var(--ok)",
      dev: "var(--accent)",
      lint: "var(--bad)",
      custom: "var(--muted)",
    };
    return colors[cat] || colors.custom;
  };

  const runningCount = Array.from(executions.values()).filter(
    (e) => e.status === "running"
  ).length;

  return (
    <div className="task-runner">
      <div className="task-runner-header" onClick={() => setExpanded(!expanded)}>
        <div className="task-runner-title">
          <span className="task-runner-icon">
            <IconTerminal />
          </span>
          <span>Task Runner</span>
          {runningCount > 0 && (
            <span className="task-runner-running">{runningCount} running</span>
          )}
        </div>
        <div className="task-runner-actions">
          <button
            className="task-runner-btn"
            title="Add Task"
            onClick={(e) => {
              e.stopPropagation();
              setShowAddTask(true);
            }}
          >
            <IconPlus />
          </button>
          <span className="task-runner-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="task-runner-body">
          {showAddTask && (
            <div className="task-runner-add">
              <input
                type="text"
                placeholder="Task name"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                className="task-runner-input"
              />
              <input
                type="text"
                placeholder="Command (e.g., npm run build)"
                value={newTaskCommand}
                onChange={(e) => setNewTaskCommand(e.target.value)}
                className="task-runner-input"
              />
              <select
                value={newTaskCategory}
                onChange={(e) => setNewTaskCategory(e.target.value as Task["category"])}
                className="task-runner-select"
              >
                <option value="custom">Custom</option>
                <option value="build">Build</option>
                <option value="test">Test</option>
                <option value="dev">Dev</option>
                <option value="lint">Lint</option>
              </select>
              <div className="task-runner-add-actions">
                <button
                  className="task-runner-btn"
                  onClick={() => setShowAddTask(false)}
                >
                  Cancel
                </button>
                <button
                  className="task-runner-btn primary"
                  onClick={handleAddTask}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="task-runner-empty">
              <p>No tasks configured</p>
              <p className="muted">Add npm scripts or custom commands</p>
            </div>
          ) : (
            <div className="task-runner-list">
              {tasks.map((task) => {
                const execution = executions.get(task.id);
                return (
                  <div key={task.id} className="task-item">
                    <div className="task-item-main">
                      <span
                        className="task-icon"
                        style={{ color: getCategoryColor(task.category) }}
                      >
                        {getCategoryIcon(task.category)}
                      </span>
                      <div className="task-info">
                        <div className="task-name">{task.name}</div>
                        <div className="task-command">{task.command}</div>
                      </div>
                      {execution && (
                        <span className={`task-status ${execution.status}`}>
                          {execution.status === "running" && "⟳"}
                          {execution.status === "success" && "✓"}
                          {execution.status === "error" && "✗"}
                        </span>
                      )}
                    </div>
                    <div className="task-item-actions">
                      {execution?.status === "running" ? (
                        <button
                          className="task-item-btn danger"
                          title="Stop"
                          onClick={() => onStopTask(task.id)}
                        >
                          <IconStop />
                        </button>
                      ) : (
                        <button
                          className="task-item-btn"
                          title="Run"
                          onClick={() => onRunTask(task.id)}
                        >
                          <IconPlay />
                        </button>
                      )}
                      <button
                        className="task-item-btn"
                        title="Remove"
                        onClick={() => onRemoveTask(task.id)}
                      >
                        <IconX />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {executions.size > 0 && (
            <div className="task-runner-executions">
              <div className="task-executions-header">
                <span>Executions</span>
                <button
                  className="task-executions-clear"
                  onClick={() => {/* Clear executions */}}
                >
                  Clear
                </button>
              </div>
              {Array.from(executions.entries()).map(([taskId, execution]) => {
                const task = tasks.find((t) => t.id === taskId);
                return (
                  <div key={taskId} className="task-execution">
                    <div className="task-execution-header">
                      <span className="task-execution-name">
                        {task?.name || taskId}
                      </span>
                      <span className={`task-execution-status ${execution.status}`}>
                        {execution.status}
                      </span>
                    </div>
                    <div className="task-execution-output">
                      {execution.output.slice(-5).map((line, i) => (
                        <div key={i} className="task-execution-line">
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook to manage task runner state
export function useTaskRunner(cwd?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [executions, setExecutions] = useState<Map<string, TaskExecution>>(new Map());

  useEffect(() => {
    // Load npm scripts from package.json if available
    const loadNpmScripts = async () => {
      if (!cwd) return;
      try {
        const packageJsonPath = `${cwd}/package.json`;
        const result = await window.api?.readFile(packageJsonPath);
        if (result && !("error" in result)) {
          const pkg = JSON.parse(result.content);
          const scripts = pkg.scripts || {};
          const npmTasks: Task[] = Object.entries(scripts).map(([name, command]) => ({
            id: `npm-${name}`,
            name: name,
            command: `npm run ${name}`,
            category: name.includes("build")
              ? "build"
              : name.includes("test")
              ? "test"
              : name.includes("dev")
              ? "dev"
              : name.includes("lint")
              ? "lint"
              : "custom",
          }));
          setTasks(npmTasks);
        }
      } catch (error) {
        console.error("Failed to load npm scripts:", error);
      }
    };

    loadNpmScripts();
  }, [cwd]);

  const runTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const execution: TaskExecution = {
      taskId,
      status: "running",
      output: [],
      startTime: Date.now(),
    };

    setExecutions((prev) => new Map(prev).set(taskId, execution));

    try {
      // Simulate running the task
      const output: string[] = [];
      output.push(`Running: ${task.command}`);
      output.push(`Started at: ${new Date().toISOString()}`);
      
      // In real implementation, this would run the actual command
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      output.push("Task completed successfully");
      
      setExecutions((prev) => {
        const updated = new Map(prev);
        const exec = updated.get(taskId);
        if (exec) {
          updated.set(taskId, {
            ...exec,
            status: "success",
            output,
            endTime: Date.now(),
          });
        }
        return updated;
      });
    } catch (error) {
      setExecutions((prev) => {
        const updated = new Map(prev);
        const exec = updated.get(taskId);
        if (exec) {
          updated.set(taskId, {
            ...exec,
            status: "error",
            output: [...exec.output, `Error: ${String(error)}`],
            endTime: Date.now(),
          });
        }
        return updated;
      });
    }
  };

  const stopTask = (taskId: string) => {
    setExecutions((prev) => {
      const updated = new Map(prev);
      const exec = updated.get(taskId);
      if (exec && exec.status === "running") {
        updated.set(taskId, {
          ...exec,
          status: "error",
          output: [...exec.output, "Task stopped by user"],
          endTime: Date.now(),
        });
      }
      return updated;
    });
  };

  const addTask = (task: Omit<Task, "id">) => {
    setTasks((prev) => [
      ...prev,
      { ...task, id: `custom-${Date.now()}` },
    ]);
  };

  const removeTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setExecutions((prev) => {
      const updated = new Map(prev);
      updated.delete(taskId);
      return updated;
    });
  };

  return {
    tasks,
    executions,
    runTask,
    stopTask,
    addTask,
    removeTask,
  };
}
