import { useI18n } from "../i18n";
import type { ReviewQueue } from "./queue";

export function ReviewStrip({
  queue,
  openFile,
  onAccept,
  onReject,
  onAlways,
  onAcceptAll,
}: {
  queue: ReviewQueue;
  openFile?: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAlways: (id: string) => void;
  onAcceptAll: () => void;
}) {
  const { t } = useI18n();
  const current = queue.items[0];
  if (!current) return null;
  const inEditor = Boolean(current.target && current.target === openFile && current.patch?.length);
  return (
    <div className="review-strip">
      <div className="review-strip-head">
        <span className="review-strip-count">
          {queue.items.length === 1 ? t("review.waitingOne") : t("review.waiting", { n: queue.items.length })}
        </span>
        <span className="review-strip-title">{current.title}</span>
      </div>
      {!inEditor && current.detail && <pre className="review-strip-diff">{current.detail}</pre>}
      <div className="review-strip-actions">
        <button className="review-accept" onClick={() => onAccept(current.id)}>
          {t("review.accept")}
        </button>
        <button className="review-reject" onClick={() => onReject(current.id)}>
          {t("review.reject")}
        </button>
        <button className="review-always" onClick={() => onAlways(current.id)}>
          {t("review.always")}
        </button>
        {queue.items.length > 1 && (
          <button className="review-accept-all" onClick={onAcceptAll}>
            {t("review.acceptAll")}
          </button>
        )}
      </div>
    </div>
  );
}
