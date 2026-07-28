import { useState, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconPlay,
  IconRefresh,
  IconStop,
  IconPlus,
  IconX,
  IconChevronDown,
  IconChevronRight,
  IconAlertTriangle,
} from "./Icons";

export interface TestResult {
  id: string;
  name: string;
  file: string;
  status: "passed" | "failed" | "skipped" | "running";
  duration?: number;
  error?: string;
  output?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  file: string;
  tests: TestResult[];
}

interface TestRunnerProps {
  suites: TestSuite[];
  onRunAll: () => void;
  onRunSuite: (suiteId: string) => void;
  onRunTest: (suiteId: string, testId: string) => void;
  onStop: () => void;
  isRunning: boolean;
  onAddTest: () => void;
  onRemoveTest: (suiteId: string, testId: string) => void;
}

export function TestRunner({
  suites,
  onRunAll,
  onRunSuite,
  onRunTest,
  onStop,
  isRunning,
  onAddTest,
  onRemoveTest,
}: TestRunnerProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"tests" | "output">("tests");
  const [selectedTest, setSelectedTest] = useState<TestResult | null>(null);

  const toggleSuite = (suiteId: string) => {
    setExpandedSuites((prev) => {
      const next = new Set(prev);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  };

  const totalTests = suites.reduce((sum, suite) => sum + suite.tests.length, 0);
  const passedTests = suites.reduce(
    (sum, suite) => sum + suite.tests.filter((t) => t.status === "passed").length,
    0
  );
  const failedTests = suites.reduce(
    (sum, suite) => sum + suite.tests.filter((t) => t.status === "failed").length,
    0
  );
  const skippedTests = suites.reduce(
    (sum, suite) => sum + suite.tests.filter((t) => t.status === "skipped").length,
    0
  );

  return (
    <div className="test-runner">
      <div className="test-runner-header" onClick={() => setExpanded(!expanded)}>
        <div className="test-runner-title">
          <span className="test-runner-icon">🧪</span>
          <span>Test Runner</span>
          <span className="test-runner-stats">
            {passedTests} passed, {failedTests} failed, {skippedTests} skipped
          </span>
        </div>
        <div className="test-runner-actions">
          <button
            className="test-runner-btn primary"
            title="Run All Tests"
            onClick={(e) => {
              e.stopPropagation();
              onRunAll();
            }}
            disabled={isRunning}
          >
            <IconPlay />
            Run All
          </button>
          {isRunning && (
            <button
              className="test-runner-btn danger"
              title="Stop"
              onClick={(e) => {
                e.stopPropagation();
                onStop();
              }}
            >
              <IconStop />
              Stop
            </button>
          )}
          <span className="test-runner-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="test-runner-body">
          <div className="test-runner-tabs">
            <button
              className={`test-runner-tab ${activeTab === "tests" ? "active" : ""}`}
              onClick={() => setActiveTab("tests")}
            >
              Tests ({totalTests})
            </button>
            <button
              className={`test-runner-tab ${activeTab === "output" ? "active" : ""}`}
              onClick={() => setActiveTab("output")}
            >
              Output
            </button>
          </div>

          <div className="test-runner-content">
            {activeTab === "tests" && (
              <div className="test-runner-section">
                {suites.length === 0 ? (
                  <div className="test-runner-empty">
                    <p>No test suites found</p>
                    <p className="muted">Create test files to get started</p>
                  </div>
                ) : (
                  <div className="test-runner-list">
                    {suites.map((suite) => (
                      <div key={suite.id} className="test-suite">
                        <div
                          className="test-suite-header"
                          onClick={() => toggleSuite(suite.id)}
                        >
                          <span className="test-suite-caret">
                            {expandedSuites.has(suite.id) ? "▾" : "▸"}
                          </span>
                          <span className="test-suite-name">{suite.name}</span>
                          <span className="test-suite-file">
                            {suite.file.split("/").pop()}
                          </span>
                          <div className="test-suite-stats">
                            <span className="test-suite-stat passed">
                              {suite.tests.filter((t) => t.status === "passed").length}
                            </span>
                            <span className="test-suite-stat failed">
                              {suite.tests.filter((t) => t.status === "failed").length}
                            </span>
                            <span className="test-suite-stat skipped">
                              {suite.tests.filter((t) => t.status === "skipped").length}
                            </span>
                          </div>
                          <button
                            className="test-suite-btn"
                            title="Run Suite"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunSuite(suite.id);
                            }}
                            disabled={isRunning}
                          >
                            <IconPlay />
                          </button>
                        </div>
                        {expandedSuites.has(suite.id) && (
                          <div className="test-suite-tests">
                            {suite.tests.map((test) => (
                              <div
                                key={test.id}
                                className={`test-item ${test.status}`}
                                onClick={() => setSelectedTest(test)}
                              >
                                <span className="test-status">
                                  {test.status === "passed" && "✓"}
                                  {test.status === "failed" && "✗"}
                                  {test.status === "skipped" && "○"}
                                  {test.status === "running" && "⟳"}
                                </span>
                                <span className="test-name">{test.name}</span>
                                {test.duration && (
                                  <span className="test-duration">
                                    {test.duration}ms
                                  </span>
                                )}
                                <button
                                  className="test-item-btn"
                                  title="Run Test"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRunTest(suite.id, test.id);
                                  }}
                                  disabled={isRunning}
                                >
                                  <IconPlay />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "output" && selectedTest && (
              <div className="test-runner-section">
                <div className="test-output-header">
                  <span className="test-output-name">{selectedTest.name}</span>
                  <button
                    className="test-output-close"
                    onClick={() => setSelectedTest(null)}
                  >
                    <IconX />
                  </button>
                </div>
                {selectedTest.error && (
                  <div className="test-output-error">
                    <IconAlertTriangle />
                    {selectedTest.error}
                  </div>
                )}
                {selectedTest.output && (
                  <pre className="test-output-content">
                    <code>{selectedTest.output}</code>
                  </pre>
                )}
              </div>
            )}

            {activeTab === "output" && !selectedTest && (
              <div className="test-runner-section">
                <div className="test-runner-empty">
                  <p>Select a test to view output</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Hook to manage test runner state
export function useTestRunner() {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runAll = async () => {
    setIsRunning(true);
    // Simulate running tests
    setSuites((prev) =>
      prev.map((suite) => ({
        ...suite,
        tests: suite.tests.map((test) => ({
          ...test,
          status: "running" as const,
        })),
      }))
    );

    // Simulate test execution
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setSuites((prev) =>
      prev.map((suite) => ({
        ...suite,
        tests: suite.tests.map((test) => ({
          ...test,
          status: Math.random() > 0.3 ? "passed" : "failed",
          duration: Math.floor(Math.random() * 1000),
          error: Math.random() > 0.3 ? undefined : "AssertionError: Expected true to be false",
        })),
      }))
    );

    setIsRunning(false);
  };

  const runSuite = async (suiteId: string) => {
    setIsRunning(true);
    setSuites((prev) =>
      prev.map((suite) =>
        suite.id === suiteId
          ? {
              ...suite,
              tests: suite.tests.map((test) => ({
                ...test,
                status: "running" as const,
              })),
            }
          : suite
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 1500));

    setSuites((prev) =>
      prev.map((suite) =>
        suite.id === suiteId
          ? {
              ...suite,
              tests: suite.tests.map((test) => ({
                ...test,
                status: Math.random() > 0.3 ? "passed" : "failed",
                duration: Math.floor(Math.random() * 500),
              })),
            }
          : suite
      )
    );

    setIsRunning(false);
  };

  const runTest = async (suiteId: string, testId: string) => {
    setIsRunning(true);
    setSuites((prev) =>
      prev.map((suite) =>
        suite.id === suiteId
          ? {
              ...suite,
              tests: suite.tests.map((test) =>
                test.id === testId
                  ? { ...test, status: "running" as const }
                  : test
              ),
            }
          : suite
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    setSuites((prev) =>
      prev.map((suite) =>
        suite.id === suiteId
          ? {
              ...suite,
              tests: suite.tests.map((test) =>
                test.id === testId
                  ? {
                      ...test,
                      status: Math.random() > 0.3 ? "passed" : "failed",
                      duration: Math.floor(Math.random() * 100),
                    }
                  : test
              ),
            }
          : suite
      )
    );

    setIsRunning(false);
  };

  const stop = () => {
    setIsRunning(false);
    setSuites((prev) =>
      prev.map((suite) => ({
        ...suite,
        tests: suite.tests.map((test) =>
          test.status === "running" ? { ...test, status: "skipped" } : test
        ),
      }))
    );
  };

  const addTest = () => {
    // In real implementation, this would create a new test file
    console.log("Add test");
  };

  const removeTest = (suiteId: string, testId: string) => {
    setSuites((prev) =>
      prev.map((suite) =>
        suite.id === suiteId
          ? {
              ...suite,
              tests: suite.tests.filter((test) => test.id !== testId),
            }
          : suite
      )
    );
  };

  return {
    suites,
    isRunning,
    runAll,
    runSuite,
    runTest,
    stop,
    addTest,
    removeTest,
  };
}
