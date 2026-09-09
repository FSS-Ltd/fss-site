import { createHash } from "node:crypto";
import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { withAgreementTransaction } from "../agreements/repository";
import { runMetricExport } from "./export-repository";
/** The worker can process only jobs previously requested by the configured founder. */
export async function runNextMetricExport(
  db: OperationsDb,
  ownerEmail: string,
): Promise<boolean> {
  const email = z.email().parse(ownerEmail.trim().toLowerCase());
  const founder = { actorId: createHash("sha256").update(email).digest("hex") };
  const id = await withAgreementTransaction(db, founder, async (tx) => {
    const [job] = await tx<
      { id: string }[]
    >`select id from operations.metric_export_jobs where state='queued' order by created_at,id limit 1`;
    return job?.id;
  });
  if (!id) return false;
  try {
    return await runMetricExport(db, founder, id);
  } catch {
    await withAgreementTransaction(db, founder, async (tx, actor) => {
      const changed =
        await tx`update operations.metric_export_jobs set state='failed',failure='Processing failed. Request a new export with narrower filters.',completed_at=now() where id=${id} and state='queued' returning id`;
      if (changed.length)
        await tx`insert into operations.metric_export_audit(job_id,actor_id,action) values(${id},${actor.actorId},'failed')`;
    });
    return false;
  }
}
