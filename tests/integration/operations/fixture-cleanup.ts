import { afterEach } from "node:test";

type Cleanup = () => Promise<void>;

const pendingCleanups: Cleanup[] = [];

export function registerFixtureCleanup(cleanup: Cleanup): Cleanup {
  let complete = false;
  const run = async () => {
    if (complete) return;
    complete = true;
    const index = pendingCleanups.indexOf(run);
    if (index >= 0) pendingCleanups.splice(index, 1);
    await cleanup();
  };
  pendingCleanups.push(run);
  return run;
}

afterEach(async () => {
  let firstError: unknown;
  for (const cleanup of [...pendingCleanups].reverse()) {
    try {
      await cleanup();
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
});
