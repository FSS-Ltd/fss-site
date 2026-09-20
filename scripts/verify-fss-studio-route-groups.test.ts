import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { verifyPortalRouteGroups } from "./verify-fss-studio-route-groups";

const validTree = {
  "app/(portal)/layout.tsx": 'import { ClerkProvider } from "@clerk/nextjs";\nexport default function PortalProviderLayout({ children }: { children: React.ReactNode }) { return <ClerkProvider>{children}</ClerkProvider>; }',
  "app/(portal)/(auth)/portal/layout.tsx": "export default function PortalAuthLayout({ children }: { children: React.ReactNode }) { return <main>{children}</main>; }",
  "app/(portal)/(client)/portal/layout.tsx": "export default function ClientPortalLayout({ children }: { children: React.ReactNode }) { return <section>{children}</section>; }",
  "app/(portal)/(studio)/portal/admin/layout.tsx": "export default function AdminLayout({ children }: { children: React.ReactNode }) { return <section>{children}</section>; }",
};

test("requires persona layouts to be siblings below the common portal provider", async () => {
  await withFixture(validTree, async (root) => {
    assert.deepEqual(verifyPortalRouteGroups(root), []);
  });

  await withFixture(
    {
      ...validTree,
      "app/(portal)/portal/layout.tsx": "export default function LegacyLayout() { return null; }",
    },
    async (root) => {
      assert.match(
        verifyPortalRouteGroups(root).join("\n"),
        /legacy portal layout/i,
      );
    },
  );
});

test("rejects missing persona layouts and client shell leakage into the provider", async () => {
  await withFixture(
    {
      "app/(portal)/layout.tsx": 'import { ClerkProvider } from "@clerk/nextjs";\nimport styles from "@/components/portal/auth/portal.module.css";\nexport default function PortalProviderLayout({ children }: { children: React.ReactNode }) { return <ClerkProvider><div className={styles.shell}>{children}</div></ClerkProvider>; }',
      "app/(portal)/(auth)/portal/layout.tsx": validTree["app/(portal)/(auth)/portal/layout.tsx"],
    },
    async (root) => {
      const violations = verifyPortalRouteGroups(root).join("\n");

      assert.match(violations, /common portal provider.*shell/i);
      assert.match(violations, /client portal layout.*missing/i);
      assert.match(violations, /Studio portal layout.*missing/i);
    },
  );
});

async function withFixture(
  files: Readonly<Record<string, string>>,
  run: (root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "fss-route-groups-"));

  try {
    await Promise.all(
      Object.entries(files).map(async ([relativePath, source]) => {
        const path = join(root, relativePath);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, source);
      }),
    );
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
