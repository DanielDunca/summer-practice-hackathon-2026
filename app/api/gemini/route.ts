import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL } from "@/lib/gemini";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt } = await request.json();
  if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ text: "" });

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error("[gemini] request failed", res.status, data?.error?.message ?? data);
      return NextResponse.json({ text: "" });
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    return NextResponse.json({ text });
  } catch (error) {
    console.error("[gemini] request error", error);
    return NextResponse.json({ text: "" });
  }
}
