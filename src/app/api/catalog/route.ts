import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/server/pg";
import { errorResponse, requireUser } from "@/lib/server/auth";
import { outletsOf, UNIT_MODELS } from "@/lib/engine/units";
import { FEED_PRESETS, STANDARDS, TEMPLATES } from "@/lib/engine/templates";
import { STANDARD_LIMITS } from "@/lib/engine/diagnostics";

export const dynamic = "force-dynamic";

/**
 * Everything a script or Claude Code needs to build a flowsheet without
 * guessing: every unit with its ports, parameters, units and defaults; the
 * templates; the feed water presets; and the standards a product or a
 * discharge can be checked against.
 */
export async function GET() {
  try {
    if (isConfigured()) await requireUser({ allowToken: true });
    return NextResponse.json({
      units: UNIT_MODELS.map((m) => ({
        type: m.type, label: m.label, short: m.short, category: m.category, description: m.description,
        inlets: m.inlets,
        outlets: outletsOf(m.type, m.defaults),
        outletsDependOnParams: !!m.dynamicOutlets,
        params: m.params.map((p) => ({
          key: p.key, label: p.label, type: p.type, unit: p.unit, min: p.min, max: p.max,
          options: p.options?.map((o) => o.value), help: p.help, group: p.group,
        })),
        defaults: m.defaults,
      })),
      templates: TEMPLATES.map((t) => ({ key: t.key, name: t.name, category: t.category, description: t.description })),
      feedPresets: FEED_PRESETS.map((p) => ({ key: p.key, label: p.label, spec: p.spec })),
      standards: STANDARDS.map((s) => ({
        key: s.key, name: s.name, scope: s.scope, limits: s.limits, checkable: !!STANDARD_LIMITS[s.key],
      })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
