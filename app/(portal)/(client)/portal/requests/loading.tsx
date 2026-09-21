import { RequestBoardSkeleton } from "@/components/portal/requests/board";
import styles from "@/components/portal/requests/requests.module.css";

export default function RequestsLoading(): React.JSX.Element {
  return (
    <div className={styles.requestPage}>
      <RequestBoardSkeleton />
    </div>
  );
}
