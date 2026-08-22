import { NextResponse, type NextRequest } from "next/server";
import { getBlogReviews, getSaunaReviews } from "@/lib/data/queries";

export const dynamic = "force-dynamic"; // 사진·후기 정책(킬스위치) 항상 최신 반영

/**
 * 지도 상세 패널용 — 블로그 후기 + 방문자 후기(회원).
 * 표시정책/출처필터는 쿼리 계층에서 적용.
 *
 * 사진은 여기 없다 — 갤러리가 후기 쿼리를 기다리지 않도록 /api/sauna-photos 로 뗐고,
 * 클라이언트가 두 요청을 병렬로 보낸다.
 * GET /api/sauna-detail?id=<saunaId>
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const [reviews, visitorReviews] = await Promise.all([
      getBlogReviews(id),
      getSaunaReviews(id),
    ]);
    return NextResponse.json({ reviews, visitorReviews });
  } catch (e) {
    const message = e instanceof Error ? e.message : "detail query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
