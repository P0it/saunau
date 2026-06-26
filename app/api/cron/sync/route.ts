/**
 * 동기화 Cron — Vercel Cron(vercel.json)이 주기 호출.
 * 목욕장업 전수 upsert + 온천 upsert + 교차링크. 신규 오픈 추적.
 * 보호: CRON_SECRET 설정 시 Authorization: Bearer <CRON_SECRET> 필요(Vercel Cron 자동 첨부).
 */
import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/ingest/runSync";

// 전수 페치(약 178콜)라 시간이 걸린다 → 최대 실행시간 상향, 동적 처리.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const apiKey = process.env.PUBLIC_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "PUBLIC_DATA_API_KEY 미설정" },
      { status: 500 },
    );
  }

  try {
    const supabase = getAdminClient();
    const summary = await runSync(supabase, {
      apiKey,
      geocodeMissing: Boolean(process.env.KAKAO_REST_API_KEY),
    });
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error("sync 실패:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
