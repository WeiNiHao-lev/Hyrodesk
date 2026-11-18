import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

/**
 * The HydroDesk skill for Claude Code, served so every teammate can install it
 * on their own machine: Settings → Claude Code gives them one sentence to paste
 * into Claude Code, which points here. Nothing secret lives in these files; the
 * connection to an account is made afterwards, approved by its owner in the
 * browser.
 */
const FILES: Record<string, string> = {
  "hydrodesk/SKILL.md": "SKILL.md",
  "hydrodesk/scripts/hydrodesk.mjs": "scripts/hydrodesk.mjs",
  "hydrodesk/references/flowsheet.md": "references/flowsheet.md",
};

const text = (body: string) => new Response(body, {
  headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
});

function installGuide(origin: string): string {
  const base = `${origin}/claude-skill/hydrodesk`;
  return `# Install the HydroDesk skill (instructions for Claude Code)

HydroDesk (${origin}) is the CCEPC water-treatment process simulator. This skill lets Claude Code read the
user's HydroDesk projects, run simulations on the server and save runs to the user's own account.
Needs Node 18 or newer.

## 1. Download the three files, byte for byte

Use curl (or Invoke-WebRequest), not a summarising web fetch, so the files arrive unchanged:

    mkdir -p "$HOME/.claude/skills/hydrodesk/scripts" "$HOME/.claude/skills/hydrodesk/references"
    curl -fsSL ${base}/SKILL.md -o "$HOME/.claude/skills/hydrodesk/SKILL.md"
    curl -fsSL ${base}/scripts/hydrodesk.mjs -o "$HOME/.claude/skills/hydrodesk/scripts/hydrodesk.mjs"
    curl -fsSL ${base}/references/flowsheet.md -o "$HOME/.claude/skills/hydrodesk/references/flowsheet.md"

If the skill is already installed, overwrite it: this is the current version.

## 2. Connect it to the user's own account

    node "$HOME/.claude/skills/hydrodesk/scripts/hydrodesk.mjs" login --url ${origin} --no-wait

It prints a link (${origin}/connect?code=XXXX-XXXX) and a code. Give both to the user and ask them to open the
link in the browser where they are signed in to HydroDesk, check the code matches, and click Approve. Then:

    node "$HOME/.claude/skills/hydrodesk/scripts/hydrodesk.mjs" wait
    node "$HOME/.claude/skills/hydrodesk/scripts/hydrodesk.mjs" whoami

## 3. Rules

- The token is kept in ~/.hydrodesk/config.json. Never read, print or copy that file, and never ask the user
  for a password or token in the chat.
- Each person connects their own Claude Code to their own account. Disconnect from HydroDesk → Settings →
  Claude Code, or with \`hydrodesk.mjs logout\`.
- Then read ~/.claude/skills/hydrodesk/SKILL.md: it explains the commands and the working rules.
`;
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const key = path.join("/");
  if (key === "install.md") return text(installGuide(new URL(req.url).origin));
  const file = FILES[key];
  if (!file) return new Response("Not found", { status: 404 });
  try {
    return text(await readFile(join(process.cwd(), "tools", "claude-skill", "hydrodesk", file), "utf8"));
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
