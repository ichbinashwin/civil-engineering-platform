import { useId, useState } from "react";
import type { PunchingShearOutcome } from "@civil/shared-types";
import { formatNumber } from "@/lib/format";
import { Pane } from "../layout/Pane";

/** Human-in-the-loop sign-off. A review is bound to the exact input snapshot it approved. */
export interface ReviewRecord {
  reviewer: string;
  note: string;
  reviewedAt: string;
  inputSignature: string;
  dcr: number;
  status: string;
  engineVersion: string;
}

interface ReviewPanelProps {
  outcome: PunchingShearOutcome;
  inputSignature: string;
  review: ReviewRecord | null;
  onReview: (record: ReviewRecord | null) => void;
  defaultReviewer: string;
}

export function ReviewPanel({
  outcome,
  inputSignature,
  review,
  onReview,
  defaultReviewer,
}: ReviewPanelProps) {
  const nameId = useId();
  const noteId = useId();
  const [reviewer, setReviewer] = useState(defaultReviewer);
  const [note, setNote] = useState("");

  const current = review !== null && review.inputSignature === inputSignature;
  const outdated = review !== null && !current;
  const canReview = outcome.ok && reviewer.trim().length > 0;

  return (
    <Pane
      id="review"
      badge={
        current ? (
          <span className="badge pass">REVIEWED</span>
        ) : outdated ? (
          <span className="badge warn">REVIEW OUTDATED</span>
        ) : (
          <span className="badge info">DRAFT</span>
        )
      }
    >
      <div>
        <p className="small" role="status" style={{ marginTop: 0 }}>
          {current && review
            ? `Reviewed by ${review.reviewer} on ${new Date(review.reviewedAt).toLocaleString()} (DCR ${formatNumber(review.dcr, 3)}, ${review.status}, engine v${review.engineVersion}).`
            : outdated && review
              ? `Inputs changed after ${review.reviewer}'s review (DCR was ${formatNumber(review.dcr, 3)}). Re-review required.`
              : "Not yet reviewed. Check inputs, warnings and trace, then sign off."}
        </p>
        {current && review?.note && <p className="note">Note: {review.note}</p>}
        <div className="row wide">
          <label htmlFor={nameId}>Reviewer</label>
          <input
            id={nameId}
            className="input text"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="Name"
          />
        </div>
        <label htmlFor={noteId} className="field-label">
          Review note
        </label>
        <textarea
          id={noteId}
          className="input text"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Assumptions checked, follow-up items…"
          style={{ marginTop: 4 }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            className="btn primary"
            disabled={!canReview}
            onClick={() =>
              outcome.ok &&
              onReview({
                reviewer: reviewer.trim(),
                note: note.trim(),
                reviewedAt: new Date().toISOString(),
                inputSignature,
                dcr: outcome.dcr,
                status: outcome.status,
                engineVersion: outcome.meta.engineVersion,
              })
            }
          >
            Mark as reviewed
          </button>
          {review && (
            <button type="button" className="btn" onClick={() => onReview(null)}>
              Clear review
            </button>
          )}
        </div>
        {!outcome.ok && <p className="small">A review requires a valid calculation.</p>}
      </div>
    </Pane>
  );
}
