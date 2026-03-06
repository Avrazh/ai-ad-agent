import { NextRequest, NextResponse } from "next/server";
import { insertDeveloperFeedback } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, imageId, templateId } = body as {
      message: string;
      imageId?: string;
      templateId?: string;
    };

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    await insertDeveloperFeedback({
      id: newId("fb"),
      message: message.trim(),
      imageId,
      templateId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Feedback error:", err);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}
