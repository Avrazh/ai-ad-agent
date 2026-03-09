import { NextRequest, NextResponse } from "next/server";
import { setApproval, getRenderResult } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { resultId, approved } = body as {
      resultId: string;
      approved: boolean;
    };

    if (!resultId || typeof approved !== "boolean") {
      return NextResponse.json(
        { error: "resultId and approved (boolean) required" },
        { status: 400 }
      );
    }

    const result = await getRenderResult(resultId);
    if (!result) {
      return NextResponse.json(
        { error: "Result not found" },
        { status: 404 }
      );
    }

    await setApproval(resultId, approved);

    return NextResponse.json({ ok: true, resultId, approved });
  } catch (err) {
    console.error("Approve error:", err);
    return NextResponse.json(
      { error: "Failed to update approval" },
      { status: 500 }
    );
  }
}
