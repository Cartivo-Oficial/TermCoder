import { fileIcon } from "../FileIcons";
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
      <span className="ws-icon" aria-hidden="true">{fileIcon(base)}</span>
      <span className="ws-path">
        <span className="ws-dir">{dir}</span>
        <span className="ws-base">{base}</span>
      </span>
      <Counts added={file.added} removed={file.removed} />
    </div>
  );
}

export interface CheckLabels { passed: string; failed: string }

function CheckRow({ check, labels }: { check: CheckRun; labels: CheckLabels }) {
  return (
    <div className="ws-check" data-ok={check.ok ? "yes" : "no"}>
      <span className="ws-mark" aria-hidden="true">
        {check.ok ? "✓" : "✗"}
      </span>
      <span className="ws-cmd" title={check.command}>
        {check.command}
      </span>
      <span className="ws-outcome">{check.ok ? labels.passed : labels.failed}</span>
    </div>
  );
}

export function WorkSummary({
  summary,
  seconds,
  labels,
  title,
}: {
  summary: TurnSummary;
  seconds?: number;
  labels: CheckLabels;
  title?: string;
}) {
  if (!summary.didWork) return null;

  const counts = summary.files.length > 0;
  const head = Boolean(title) || counts;

  return (
    <Panel
      className="work-summary"
      head={
        head ? (
          <>
            {title ? (
              <span className="ws-title" title={title}>
                {title}
              </span>
            ) : null}
            {counts ? <Counts added={summary.added} removed={summary.removed} /> : null}
          </>
        ) : undefined
      }
    >
      {summary.files.map((file) => (
        <FileRow key={file.path} file={file} />
      ))}
      {seconds === undefined ? null : <div className="ws-time">{formatDuration(seconds)}</div>}
      {summary.checks.map((check, i) => (
        <CheckRow key={`${check.command}-${i}`} check={check} labels={labels} />
      ))}
    </Panel>
  );
}
