import { Panel } from "../ui";
import { formatDuration, splitPath, type CheckRun, type FileChange, type TurnSummary } from "./summary";

function Counts({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="ws-counts">
      <span className="ws-add">+{added}</span> <span className="ws-del">−{removed}</span>
    </span>
  );
}

function FileRow({ file }: { file: FileChange }) {
  const { dir, base } = splitPath(file.path);
  return (
    <div className="ws-file" title={file.path}>
      <span className="ws-path">
        <span className="ws-dir">{dir}</span>
        <span className="ws-base">{base}</span>
      </span>
      <Counts added={file.added} removed={file.removed} />
    </div>
  );
}

function CheckRow({ check }: { check: CheckRun }) {
  return (
    <div className="ws-check" data-ok={check.ok ? "yes" : "no"}>
      <span className="ws-mark" aria-hidden="true">
        {check.ok ? "✓" : "✗"}
      </span>
      <span className="ws-cmd" title={check.command}>
        {check.command}
      </span>
      <span className="ws-outcome">{check.ok ? "passed" : "failed"}</span>
    </div>
  );
}

export function WorkSummary({ summary, seconds }: { summary: TurnSummary; seconds?: number }) {
  if (!summary.didWork) return null;

  return (
    <Panel
      className="work-summary"
      head={
        summary.files.length > 0 ? (
          <Counts added={summary.added} removed={summary.removed} />
        ) : undefined
      }
    >
      {summary.files.map((file) => (
        <FileRow key={file.path} file={file} />
      ))}
      {seconds === undefined ? null : <div className="ws-time">{formatDuration(seconds)}</div>}
      {summary.checks.map((check, i) => (
        <CheckRow key={`${check.command}-${i}`} check={check} />
      ))}
    </Panel>
  );
}
