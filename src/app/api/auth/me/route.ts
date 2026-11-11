import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/server/pg";
import { currentUser, errorResponse, needsSetup } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** Who is signed in, and whether the first account still has to be created. */
export async function GET() {
  if (!isConfigured()) return NextResponse.json({ user: null, needsSetup: false, cloud: false });
  try {
    const user = await currentUser();
    return NextResponse.json(
      { user, needsSetup: user ? false : await needsSetup(), cloud: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
