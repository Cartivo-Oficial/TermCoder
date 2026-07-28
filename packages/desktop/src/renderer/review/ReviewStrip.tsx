import type { ReviewQueue } from "./queue";

export function ReviewStrip({
  queue,
  openFile,
  onAccept,
  onReject,
  onAcceptAll,
}: {
  queue: ReviewQueue;
  openFile?: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
}) {
  const current = queue.items[0];
  if (!current) return null;
  const inEditor = Boolean(current.target && current.target === openFile && current.patch?.length);
  return (
    <div className="review-strip">
      <div className="review-strip-head">
        <span className="review-strip-count">
          {queue.items.length === 1 ? "1 change waiting" : `${queue.items.length} changes waiting`}
        </span>
        <span className="review-strip-title">{current.title}</span>
      </div>
      {!inEditor && current.detail && <pre className="review-strip-diff">{current.detail}</pre>}
      <div className="review-strip-actions">
        <button className="review-accept" onClick={() => onAccept(current.id)}>
          Accept
        </button>
        <button className="review-reject" onClick={() => onReject(current.id)}>
          Reject
        </button>
        {queue.items.length > 1 && (
          <button className="review-accept-all" onClick={onAcceptAll}>
            Accept all
          </button>
        )}
      </div>
    </div>
  );
}
