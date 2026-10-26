import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { executeCrmCommand } from "../../lib/growth/crm/commands";
import {
  crmTestFounder as founder,
  withCrmTestDatabase,
} from "../integration/growth/crm-test-fixtures";

const databaseUrl = process.env.FSS_CRM_TEST_DATABASE_URL;
async function signIn(context: BrowserContext) {
  const secret = process.env.FSS_CRM_TEST_AUTH_SECRET;
  if (!secret) throw new Error("Missing disposable test auth secret.");
  const token = await encode({
    secret,
    salt: "authjs.session-token",
    maxAge: 3600,
    token: {
      sub: "crm-test-founder",
      email: founder.email,
      name: "Test founder",
      founderEmailVerified: true,
    },
  });
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: "http://localhost:3229",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
async function fillCapture(
  page: Page,
  input: { businessName: string; companyNumber: string },
) {
  await page
    .getByLabel("Legal business name", { exact: true })
    .fill(input.businessName);
  await page
    .getByLabel("Company number", { exact: true })
    .fill(input.companyNumber);
  await page.getByLabel("Sector", { exact: true }).fill("Engineering");
  await page.getByLabel("Kent town", { exact: true }).fill("Maidstone");
  await page
    .getByLabel("Business source URL", { exact: true })
    .fill("https://example.test/about");
  await page
    .getByLabel("Opportunity", { exact: true })
    .fill("Improve enquiry workflow");
  await page.getByLabel("Recommended offer", { exact: true }).fill("Website");
  await page.getByLabel("One-off maximum (£)", { exact: true }).fill("2000");
}

test("capture, edit, duplicate conflict, deal properties and filtered board/list use real routes", async ({
  page,
  context,
}) =>
  withCrmTestDatabase(async (sql, newLead) => {
    await signIn(context);
    const input = {
      ...newLead(),
      businessName: `Browser Engineering ${randomUUID().slice(0, 8)}`,
    };
    await page.goto("/growth/prospects/new");
    await fillCapture(page, input);
    const includeContact = page.getByLabel("Add a sourced contact");
    await includeContact.focus();
    await page.keyboard.press("Space");
    await page.getByLabel("First name", { exact: true }).fill("Ada");
    await page.getByLabel("Last name", { exact: true }).fill("Example");
    await page
      .getByLabel("Email", { exact: true })
      .fill(`${input.companyNumber.toLowerCase()}@example.test`);
    await page
      .getByLabel("Contact source URL", { exact: true })
      .fill("https://example.test/team");
    await page
      .getByLabel("Contact checked (your device time)")
      .fill("2026-10-25T12:00");
    await page
      .getByLabel("Lawful basis for holding this contact")
      .selectOption("legitimate_interests");
    await page
      .getByRole("button", { name: "Create lead", exact: true })
      .click();
    await expect(page).toHaveURL(/\/growth\/prospects\/[a-f0-9-]{36}$/);
    await expect(
      page.getByRole("heading", { name: input.businessName, exact: true }),
    ).toBeVisible();
    await page.getByText("Edit company details", { exact: true }).click();
    const company = page.getByRole("form", { name: "Edit company details" });
    await company.getByLabel("Trading name").fill("Engineering Studio");
    await company.getByRole("button", { name: "Save company" }).click();
    await expect(company.getByRole("status")).toHaveText("Saved.");
    await page.getByText("Edit contact details", { exact: true }).click();
    const contact = page.getByRole("form", { name: "Edit contact details" });
    await contact.getByLabel("Last name").fill("Reviewed");
    await contact.getByRole("button", { name: "Save contact" }).click();
    await expect(page.getByText("Ada Reviewed", { exact: true })).toBeVisible();
    await page.getByText("Edit lead opportunity", { exact: true }).click();
    const leadEditor = page.getByRole("form", {
      name: "Edit lead opportunity",
    });
    await leadEditor
      .getByLabel("One-off maximum (£)", { exact: true })
      .fill("4000");
    await leadEditor.getByRole("button", { name: "Save lead" }).click();
    await expect(
      page.getByText(/Estimated one-off value: £0–£4,000/),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Create deal", exact: true })
      .click();
    await expect(page).toHaveURL(/\/growth\/deals\/[a-f0-9-]{36}$/);
    await page.getByText("Edit deal properties", { exact: true }).click();
    const deal = page.getByRole("form", { name: "Edit deal properties" });
    await deal.getByLabel("Deal one-off (£)", { exact: true }).fill("3000");
    await deal
      .getByLabel("Deal monthly (£/month)", { exact: true })
      .fill("150");
    await deal.getByLabel("Probability (%)").fill("40");
    await deal.getByLabel("Expected close").fill("2026-11-30");
    await deal.getByRole("button", { name: "Save deal" }).click();
    await expect(deal.getByRole("status")).toHaveText("Saved.");
    await page.goto(
      `/growth/pipeline?q=${encodeURIComponent(input.businessName)}`,
    );
    await expect(
      page.getByRole("link", { name: input.businessName, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toContainText("£3,000 one-off");
    await page.getByRole("link", { name: "List", exact: true }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page).toHaveURL(/view=list/);
    await page.getByText("Save or manage views", { exact: true }).click();
    const save = page.getByRole("form", { name: "Save pipeline view" });
    await save
      .getByLabel("View name", { exact: true })
      .fill(`Focus ${input.companyNumber}`);
    await save.getByRole("button", { name: "Save current view" }).click();
    await expect(
      page.getByRole("link", {
        name: `Focus ${input.companyNumber}`,
        exact: true,
      }),
    ).toBeVisible();
    await page.getByText("Save or manage views", { exact: true }).click();
    await page
      .getByLabel("Pipeline layout")
      .getByRole("link", { name: "Board", exact: true })
      .click();
    await expect(page).toHaveURL(/q=/);
    await expect(page).not.toHaveURL(/view=list/);
    await expect(
      page.getByRole("link", { name: input.businessName, exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `output/growth-crm-${test.info().project.name}-pipeline.png`,
      fullPage: true,
    });
    await page.goto("/growth/prospects/new");
    await fillCapture(page, input);
    await page
      .getByRole("button", { name: "Create lead", exact: true })
      .click();
    await expect(
      page.getByRole("form", { name: "Capture lead" }).getByRole("alert"),
    ).toContainText("already");
    await expect(
      page.getByRole("link", { name: "Open existing record" }),
    ).toBeVisible();
    const [view] = await sql<
      { id: string }[]
    >`delete from growth.crm_saved_views where name=${"Focus " + input.companyNumber} returning id`;
    if (view)
      await sql`delete from growth.audit_log where entity_id=${view.id}`;
  }, databaseUrl));

test("activity and task lifecycle persist with promotion, completion and reopen", async ({
  page,
  context,
}) =>
  withCrmTestDatabase(async (sql, newLead) => {
    await signIn(context);
    const captured = await executeCrmCommand(
      sql,
      newLead(),
      founder,
      randomUUID(),
    );
    await page.goto(`/growth/prospects/${captured.prospectId}`);
    const activity = page.getByRole("form", { name: "Log activity" });
    for (const type of ["note", "call", "meeting"]) {
      await activity.getByLabel("Activity type").selectOption(type);
      await activity
        .getByLabel("Activity details")
        .fill(`Browser ${type} <script>safe text</script>`);
      await activity.getByRole("button", { name: "Log activity" }).click();
      await expect(
        page.getByText(`Browser ${type} <script>safe text</script>`, {
          exact: true,
        }),
      ).toBeVisible();
    }
    const task = page.getByRole("form", { name: "Create follow-up task" });
    await task.getByLabel("Task title").fill("Call director");
    await task.getByLabel("Due (your device time)").fill("2026-11-02T10:30");
    await task.getByRole("button", { name: "Add task" }).click();
    const item = page
      .locator("#record-tasks li")
      .filter({ hasText: "Call director" });
    await expect(item).toBeVisible();
    const promotion = Promise.withResolvers<void>();
    const promotionDelivered = Promise.withResolvers<void>();
    await page.route("**/api/growth/crm/*", async (route) => {
      const response = await route.fetch();
      await promotion.promise;
      await route.fulfill({ response });
      promotionDelivered.resolve();
    });
    await item.getByRole("button", { name: "Make next step" }).click();
    await expect(
      item.getByRole("button", { name: "Complete task" }),
    ).toBeDisabled();
    promotion.resolve();
    await promotionDelivered.promise;
    await page.unroute("**/api/growth/crm/*");
    await item.getByRole("button", { name: "Complete task" }).click();
    await expect(item).not.toBeVisible();
    await page
      .getByRole("navigation", { name: "Task status" })
      .getByRole("link", { name: "Completed", exact: true })
      .click();
    const completed = page
      .locator("#record-tasks li")
      .filter({ hasText: "Call director" });
    await expect(completed).toBeVisible();
    await completed.getByRole("button", { name: "Reopen task" }).click();
    await expect(completed).not.toBeVisible();
    await page
      .getByRole("navigation", { name: "Task status" })
      .getByRole("link", { name: "Open", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Complete task" }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `output/growth-crm-${test.info().project.name}-record.png`,
      fullPage: true,
    });
    const [stored] =
      await sql`select next_action from growth.prospects where id=${captured.prospectId!}`;
    expect(stored.next_action).toBe("Call director");
  }, databaseUrl));

test("enquiry conversion retains provenance and produces one linked lead", async ({
  page,
  context,
}) =>
  withCrmTestDatabase(async (sql, newLead) => {
    await signIn(context);
    const input = {
      ...newLead(),
      businessName: "Enquiry " + randomUUID().slice(0, 8),
    };
    const [enquiry] = await sql<
      { id: string }[]
    >`insert into growth.inbound_leads(submission_id,submission_type,first_name,last_name,work_email,business_name,challenge,source_path,source_context,newsletter_opt_in) values (${randomUUID()},'site_enquiry','Ada','Example','enquiry@example.test',${input.businessName},'Improve enquiry workflow','/contact','CRM test',false) returning id`;
    await page.goto(`/growth/prospects/enquiries/${enquiry.id}`);
    await fillCapture(page, input);
    await page
      .getByRole("button", { name: "Create lead from enquiry" })
      .click();
    await expect(page).toHaveURL(/\/growth\/prospects\/[a-f0-9-]{36}$/);
    const url = page.url();
    await page.goto(`/growth/prospects/enquiries/${enquiry.id}`);
    await expect(
      page.getByRole("heading", { name: "Lead already created" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Open lead", exact: true }).click();
    await expect(page).toHaveURL(url);
  }, databaseUrl));

test("unauthenticated CRM commands cannot write", async ({ request }) => {
  const id = randomUUID();
  const response = await request.post(`/api/growth/crm/${id}`, {
    headers: { origin: "http://localhost:3229" },
    data: {
      kind: "save_view",
      requestId: id,
      name: "Unauthorized",
      filters: {},
    },
  });
  expect(response.status()).toBe(401);
});

test("missed cross-tab changes reconcile on focus with zero idle refresh requests", async ({
  page,
  context,
}) =>
  withCrmTestDatabase(async (sql, newLead) => {
    await signIn(context);
    const captured = await executeCrmCommand(
      sql,
      newLead(),
      founder,
      randomUUID(),
    );
    const path = `/growth/prospects/${captured.prospectId}`;
    await page.goto(path);
    const other = await context.newPage();
    await other.goto(path);
    await page.bringToFront();
    const activity = page.getByRole("form", { name: "Log activity" });
    await activity
      .getByLabel("Activity details")
      .fill("Committed in another tab");
    await activity.getByRole("button", { name: "Log activity" }).click();
    await expect(
      page.getByText("Committed in another tab", { exact: true }),
    ).toBeVisible();
    await other.bringToFront();
    await expect(
      other.getByText("Committed in another tab", { exact: true }),
    ).toBeVisible();
    let refreshRequests = 0;
    other.on("request", (request) => {
      if (request.url().includes("_rsc=")) refreshRequests++;
    });
    // This bounded idle observation measures requests, rather than waiting for a UI state.
    await other.waitForTimeout(1200);
    expect(refreshRequests).toBe(0);
    await other.close();
  }, databaseUrl));

test("lost save responses retain pending feedback and retry idempotently", async ({
  page,
  context,
}) =>
  withCrmTestDatabase(async (sql, newLead) => {
    await signIn(context);
    const captured = await executeCrmCommand(
      sql,
      newLead(),
      founder,
      randomUUID(),
    );
    await page.goto(`/growth/prospects/${captured.prospectId}`);
    const release = Promise.withResolvers<void>();
    await page.route("**/api/growth/crm/*", async (route) => {
      await route.fetch();
      await release.promise;
      await route.abort("failed");
    });
    const form = page.getByRole("form", { name: "Log activity" });
    await form
      .getByLabel("Activity details")
      .fill("Recover this committed note");
    await form.getByRole("button", { name: "Log activity" }).click();
    await expect(form.getByRole("button", { name: "Saving…" })).toBeDisabled();
    release.resolve();
    await expect(form.getByRole("alert")).toContainText("connection");
    await page.unroute("**/api/growth/crm/*");
    await form.getByRole("button", { name: "Log activity" }).click();
    await expect(
      page.getByText("Recover this committed note", { exact: true }),
    ).toBeVisible();
    const [count] =
      await sql`select count(*)::int count from growth.crm_activities where prospect_id=${captured.prospectId!} and body='Recover this committed note'`;
    expect(count.count).toBe(1);
  }, databaseUrl));

test("private saved views can be renamed and deleted with cancellation", async ({
  page,
  context,
}) =>
  withCrmTestDatabase(async (sql) => {
    await signIn(context);
    const id = randomUUID();
    const original = "Browser view " + id.slice(0, 8);
    const renamed = "Renamed " + id.slice(0, 8);
    try {
      await executeCrmCommand(
        sql,
        {
          kind: "save_view",
          requestId: id,
          name: original,
          filters: {
            q: original,
            stage: "all",
            sector: "",
            location: "",
            nextAction: "all",
            view: "board",
          },
        },
        founder,
        randomUUID(),
      );
      await page.goto("/growth/pipeline");
      await expect(
        page.getByRole("link", { name: original, exact: true }),
      ).toBeVisible();
      await page.getByText("Save or manage views", { exact: true }).click();
      const form = page.getByRole("form", { name: `Rename ${original}` });
      await form.getByLabel("Saved view name").fill(renamed);
      await form.getByRole("button", { name: "Rename view" }).click();
      await expect(
        page.getByRole("link", { name: renamed, exact: true }),
      ).toBeVisible();
      page.once("dialog", (dialog) => dialog.dismiss());
      await page
        .getByRole("button", { name: `Delete ${renamed}`, exact: true })
        .click();
      await expect(
        page.getByRole("link", { name: renamed, exact: true }),
      ).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: `Delete ${renamed}`, exact: true })
        .click();
      await expect(
        page.getByRole("link", { name: renamed, exact: true }),
      ).not.toBeVisible();
      const [row] =
        await sql`select count(*)::int count from growth.crm_saved_views where id=${id}`;
      expect(row.count).toBe(0);
    } finally {
      await sql`delete from growth.crm_saved_views where id=${id}`;
      await sql`delete from growth.audit_log where entity_id=${id}`;
    }
  }, databaseUrl));

test("pipeline controls follow built-in and private view navigation", async ({
  page,
  context,
}) =>
  withCrmTestDatabase(async (sql) => {
    await signIn(context);
    const id = randomUUID();
    const name = "Navigation " + id;
    try {
      await executeCrmCommand(
        sql,
        {
          kind: "save_view",
          requestId: id,
          name,
          filters: {
            q: "View search",
            stage: "qualified",
            sector: "Engineering",
            location: "Maidstone",
            nextAction: "upcoming",
            view: "list",
          },
        },
        founder,
        randomUUID(),
      );
      await page.goto("/growth/pipeline?stage=proposal&nextAction=overdue");
      const form = page.getByRole("form", { name: "Filter pipeline" });
      await expect(
        form.getByRole("combobox", { name: "Next step", exact: true }),
      ).toHaveValue("overdue");
      await page
        .getByRole("link", { name: "Missing next step", exact: true })
        .click();
      await expect(
        form.getByRole("combobox", { name: "Next step", exact: true }),
      ).toHaveValue("missing");
      await page.getByRole("link", { name, exact: true }).click();
      await expect(
        form.getByRole("combobox", { name: "Stage", exact: true }),
      ).toHaveValue("qualified");
      await expect(
        form.getByRole("combobox", { name: "Next step", exact: true }),
      ).toHaveValue("upcoming");
      await expect(form.getByLabel("Search", { exact: true })).toHaveValue(
        "View search",
      );
      await page
        .getByRole("link", { name: "Open opportunities", exact: true })
        .click();
      await expect(
        form.getByRole("combobox", { name: "Stage", exact: true }),
      ).toHaveValue("all");
      await expect(
        form.getByRole("combobox", { name: "Next step", exact: true }),
      ).toHaveValue("all");
      await expect(form.getByLabel("Search", { exact: true })).toHaveValue("");
    } finally {
      await sql`delete from growth.crm_saved_views where id=${id}`;
      await sql`delete from growth.audit_log where entity_id=${id}`;
    }
  }, databaseUrl));
