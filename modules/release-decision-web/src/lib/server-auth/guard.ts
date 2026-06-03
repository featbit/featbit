import { NextResponse } from "next/server";
import { getSession } from "./require";
import type { ServerSession } from "./sessions";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Routes called from the browser must have a valid FeatBit-backed session. */
export async function requireAuth(): Promise<ServerSession | NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  return session;
}

/**
 * Compatibility wrapper for older experiment routes.
 * Agent bearer tokens were removed; release-decision API access now uses the
 * same FeatBit session as the browser and FeatBit API calls.
 */
export async function requireAuthForExperiment(
  _req: Request,
  _experimentId: string,
): Promise<ServerSession | NextResponse> {
  return requireAuth();
}
