import { NextRequest, NextResponse } from "next/server";
import { FEATBIT_API_V1 } from "@/lib/featbit-auth/config";

interface ApiEnvelope<T> {
  success: boolean;
  errors?: string[];
  data?: T;
}

interface ReleaseDecisionExperimentDetail {
  experimentRuns?: Array<{
    id: string;
    inputData?: string | null;
    analysisResult?: string | null;
  }>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: experimentId } = await params;
  const body = await req.json();
  const { envId, runId, forceFresh } = body as {
    envId?: string;
    runId?: string;
    forceFresh?: boolean;
  };

  const authorization = req.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!envId) {
    return NextResponse.json(
      { error: "FeatBit environment is required" },
      { status: 400 },
    );
  }

  if (!runId) {
    return NextResponse.json(
      { error: "runId is required" },
      { status: 400 },
    );
  }

  try {
    const apiResponse = await fetch(
      `${FEATBIT_API_V1}/envs/${envId}/release-decision/experiments/${experimentId}/runs/${runId}/analyze`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          Organization: req.headers.get("organization") ?? "",
          Workspace: req.headers.get("workspace") ?? "",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ forceFresh: Boolean(forceFresh) }),
      },
    );

    const parsed = (await apiResponse.json()) as ApiEnvelope<ReleaseDecisionExperimentDetail>;
    if (!apiResponse.ok || parsed.success === false) {
      return NextResponse.json(
        { error: parsed.errors?.join(", ") || "Analyze failed" },
        { status: apiResponse.status },
      );
    }

    const run = parsed.data?.experimentRuns?.find((item) => item.id === runId);

    return NextResponse.json({
      inputData: run?.inputData ?? null,
      analysisResult: run?.analysisResult ?? null,
      dataSource: "featbit-api",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analyze failed" },
      { status: 503 },
    );
  }
}
