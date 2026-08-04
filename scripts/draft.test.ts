import "fake-indexeddb/auto";
import { Flowsheet } from "../src/lib/engine/types";
import { TEMPLATES } from "../src/lib/engine/templates";
import {
  clearDraft, draftKey, isEmptyStudy, loadDraft, saveDraft, SCRATCH,
} from "../src/lib/store/draft";
import { emptyProject, getProject, saveProject, deleteProject } from "../src/lib/store/db";

/**
 * The autosave, exercised against a real IndexedDB implementation.
 *
 * This is the failure the user actually hit — work on the canvas disappearing
 * when the tab closed — so it gets a test that touches the same storage the
 * browser does, rather than a check that the code merely compiles.
 *
 * Run with: npx tsx scripts/draft.test.ts
 */

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("draft autosave");

  /* ---- keys ---- */
  check("no project falls back to the scratch key", draftKey(null) === SCRATCH);
  check("a project gets its own key", draftKey("proj-1") === "proj-1");

  /* ---- emptiness, which decides whether a draft is worth keeping ---- */
  const blank = TEMPLATES.find((t) => t.key === "blank")!.make();
  check("a blank study counts as empty", isEmptyStudy(blank));

  const withNode = TEMPLATES.find((t) => t.key === "demin-ro-edi")!.make();
  check("a study with blocks is not empty", !isEmptyStudy(withNode));

  const feedOnly: Flowsheet = {
    ...blank,
    feed: { ...blank.feed, name: "Reservoir", c: { TDS: 365 } },
  };
  check(
    "a study with only a feed analysis is not empty",
    !isEmptyStudy(feedOnly),
    "typing a water analysis and no blocks must still be kept",
  );

  /* ---- round trip ---- */
  const key = draftKey("proj-1");
  await saveDraft({ flowsheet: withNode, studyName: "Leachate rev A", key, savedAt: new Date().toISOString() });
  const back = await loadDraft(key);
  check("a saved draft comes back", !!back);
  check("the flowsheet survives", back?.flowsheet.nodes.length === withNode.nodes.length,
    `${back?.flowsheet.nodes.length} vs ${withNode.nodes.length}`);
  check("the edges survive", back?.flowsheet.edges.length === withNode.edges.length);
  check("the study name survives", back?.studyName === "Leachate rev A");
  check("unit parameters survive", JSON.stringify(back?.flowsheet.nodes.map((n) => n.params))
    === JSON.stringify(withNode.nodes.map((n) => n.params)));
  check("the feed analysis survives", JSON.stringify(back?.flowsheet.feed) === JSON.stringify(withNode.feed));

  /* ---- drafts are per project, and do not bleed into each other ---- */
  const other = TEMPLATES.find((t) => t.key === "seawater-desal")!.make();
  await saveDraft({ flowsheet: other, studyName: "Batam SWRO", key: draftKey("proj-2"), savedAt: new Date().toISOString() });
  const a = await loadDraft(draftKey("proj-1"));
  const b = await loadDraft(draftKey("proj-2"));
  check("project 1 keeps its own draft", a?.studyName === "Leachate rev A");
  check("project 2 keeps its own draft", b?.studyName === "Batam SWRO");
  check("the two differ", a?.flowsheet.nodes.length !== b?.flowsheet.nodes.length);

  const scratch = await loadDraft(SCRATCH);
  check("the scratch key is untouched by project drafts", scratch === undefined);

  /* ---- clearing, which is what "start a new study" relies on ---- */
  await clearDraft(draftKey("proj-1"));
  check("a cleared draft is gone", (await loadDraft(draftKey("proj-1"))) === undefined);
  check("clearing one does not clear the other", (await loadDraft(draftKey("proj-2")))?.studyName === "Batam SWRO");

  /* ---- overwrite, since every keystroke rewrites the same key ---- */
  const k2 = draftKey("proj-2");
  await saveDraft({ flowsheet: blank, studyName: "Emptied", key: k2, savedAt: new Date().toISOString() });
  check("a later save replaces the earlier one", (await loadDraft(k2))?.studyName === "Emptied");

  /* ---- the site-visit checklist, which lives in the project record ---- */
  console.log("\nprepare answers");
  const proj = { ...emptyProject(), name: "Bantargebang IPAS 2", client: "DLH DKI", kind: "WWTP" as const };
  await saveProject(proj);
  const loadedProj = await getProject(proj.id);
  check("a project round-trips", loadedProj?.name === "Bantargebang IPAS 2");
  check("a project with no site visit has no prepare record", loadedProj?.prepare === undefined);

  const withPrepare = {
    ...loadedProj!,
    prepare: {
      condition: "brownfield",
      type: "wtp-surface",
      checked: { "u-1a": true, "w-1b": true },
      notes: { "u-1a": "Waduk, TDS 365 mg/L", "w-1b": "kira-kira 15 NTU" },
      updatedAt: new Date().toISOString(),
    },
  };
  await saveProject(withPrepare);
  const back2 = await getProject(proj.id);
  check("ticks survive a reload", back2?.prepare?.checked["u-1a"] === true);
  check("notes survive a reload", back2?.prepare?.notes["u-1a"] === "Waduk, TDS 365 mg/L");
  check("the chosen guide survives", back2?.prepare?.type === "wtp-surface");
  check("the site condition survives", back2?.prepare?.condition === "brownfield");

  // Two projects must not share one checklist — the bug this replaced.
  const proj2 = { ...emptyProject(), name: "Gresik salt", client: "ACWA", kind: "ZLD / MLD" as const };
  await saveProject(proj2);
  const p2back = await getProject(proj2.id);
  check(
    "a second project starts with an empty checklist",
    p2back?.prepare === undefined,
    "answers used to be shared across every project through one localStorage key",
  );
  check(
    "the first project still has its answers",
    (await getProject(proj.id))?.prepare?.notes["u-1a"] === "Waduk, TDS 365 mg/L",
  );

  await deleteProject(proj.id);
  await deleteProject(proj2.id);
  check("a deleted project is gone", (await getProject(proj.id)) === undefined);

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
