import styles from "./outreach-workspace.module.css";
import outreachStyles from "./outreach.module.css";

export function DraftPagination({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}): React.JSX.Element {
  return (
    <nav aria-label="Email draft pagination" className={styles.pagination}>
      <p role="status">
        Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}{" "}
        drafts
      </p>
      <div className={styles.pageActions}>
        <button
          className={outreachStyles.actionButton}
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} of {pageCount}
        </span>
        <button
          className={outreachStyles.actionButton}
          type="button"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
