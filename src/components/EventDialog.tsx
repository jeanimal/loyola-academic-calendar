import { useEffect, useRef } from "react";
import { categoryLabel } from "../lib/categories.ts";
import { daysBetween, formatLong } from "../lib/dates.ts";
import type { AcademicEvent } from "../lib/types.ts";

type Props = {
  event: AcademicEvent | null;
  onClose: () => void;
};

/** Event details in a native <dialog> (focus trapping and Esc for free). */
export function EventDialog({ event, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (event && !dialog.open) dialog.showModal();
    if (!event && dialog.open) dialog.close();
  }, [event]);

  const days = event ? daysBetween(event.start, event.end) + 1 : 0;

  return (
    <dialog
      ref={ref}
      className="event-dialog"
      onClose={onClose}
      onClick={(e) => {
        // Click on the backdrop closes the dialog.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="event-dialog-title"
    >
      {event && (
        <div className="dialog-body">
          <div className="dialog-head">
            <span className={`pill cat-${event.category}`}>{categoryLabel(event.category)}</span>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <h2 id="event-dialog-title">{event.title}</h2>
          <p className="dialog-dates">
            {event.start === event.end ? (
              formatLong(event.start)
            ) : (
              <>
                {formatLong(event.start)} – {formatLong(event.end)}
                <span className="muted"> · {days} days</span>
              </>
            )}
          </p>
          <p className="muted">{event.term}</p>

          {event.warning && (
            <p className="warning" role="alert">
              ⚠ {event.warning}
            </p>
          )}

          <figure className="source-quote">
            <blockquote>{event.description}</blockquote>
            <figcaption>
              Loyola's wording
              {event.note && <> · Note on Loyola's page: “{event.note}”</>}
            </figcaption>
          </figure>

          <a className="source-link" href={event.sourceUrl} target="_blank" rel="noopener">
            Verify on Loyola's official calendar ↗
          </a>
        </div>
      )}
    </dialog>
  );
}
