import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs"; // service_role(RLS 우회)
export const dynamic = "force-dynamic";

/**
 * 관리자 신고함 — 접수된 사진 신고를 사진 단위로 묶어 내려준다.
 *
 * photo_reports 에는 read RLS 정책이 없어(운영자 전용) anon 키로는 볼 수 없다.
 * 이 라우트가 없던 동안 신고는 쌓이기만 하고 아무도 읽지 않았다 — 신고 버튼이
 * 실제 조치로 이어지게 하는 것이 이 엔드포인트의 목적이다.
 *
 * GET /api/admin/reports?status=open|all  → { items: ReportedPhoto[] }
 *   status=open(기본): 아직 노출 중인 사진의 신고만(=조치가 필요한 것)
 *   status=all:        이미 내려간 사진 포함(조치 이력 확인용)
 */
export async function GET(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const onlyOpen = req.nextUrl.searchParams.get("status") !== "all";
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("photo_reports")
    .select(
      "id, photo_id, reason, note, created_at, " +
        "sauna_photos!inner(id, url, source, is_active, sauna_id, saunas!inner(name, sido, slug))",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ ok: false, reason: "query_failed" }, { status: 500 });
  }

  // 사진 단위로 묶는다 — 운영자가 보는 단위는 "신고 1건"이 아니라 "이 사진".
  const byPhoto = new Map<
    string,
    {
      photoId: string;
      url: string;
      source: string;
      isActive: boolean;
      saunaId: string;
      saunaName: string;
      sido: string | null;
      slug: string | null;
      count: number;
      reasons: string[];
      notes: string[];
      lastReportedAt: string;
    }
  >();

  for (const r of data ?? []) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const photo = (r as any).sauna_photos;
    if (!photo) continue;
    if (onlyOpen && !photo.is_active) continue;
    const sauna = photo.saunas;
    const cur = byPhoto.get(photo.id);
    if (cur) {
      cur.count += 1;
      if (!cur.reasons.includes((r as any).reason)) {
        cur.reasons.push((r as any).reason);
      }
      if ((r as any).note) cur.notes.push((r as any).note);
    } else {
      byPhoto.set(photo.id, {
        photoId: photo.id,
        url: photo.url,
        source: photo.source,
        isActive: photo.is_active,
        saunaId: photo.sauna_id,
        saunaName: sauna?.name ?? "(알 수 없음)",
        sido: sauna?.sido ?? null,
        slug: sauna?.slug ?? null,
        count: 1,
        reasons: [(r as any).reason],
        notes: (r as any).note ? [(r as any).note] : [],
        lastReportedAt: (r as any).created_at,
      });
    }
  }

  // 많이 신고된 순 → 최근 순.
  const items = [...byPhoto.values()].sort(
    (a, b) =>
      b.count - a.count ||
      b.lastReportedAt.localeCompare(a.lastReportedAt),
  );

  return NextResponse.json({ ok: true, items });
}
