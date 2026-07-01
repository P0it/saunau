import { NextResponse, type NextRequest } from "next/server";
import {
  getSaunaPhotos,
  getBlogReviews,
  getSaunaReviews,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic"; // 사진·후기 정책(킬스위치) 항상 최신 반영

/**
 * 지도 상세 패널용 — 사우나 사진 + 블로그 후기 + 방문자 후기(회원).
 * 표시정책/출처필터는 쿼리 계층에서 적용. 패널이 상세 페이지와 동일한 본문을
 * 인라인으로 렌더하도록 한 번에 내려준다.
 * GET /api/sauna-detail?id=<saunaId>
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const [photos, reviews, visitorReviews] = await Promise.all([
      getSaunaPhotos(id),
      getBlogReviews(id),
      getSaunaReviews(id),
    ]);
    return NextResponse.json({ photos, reviews, visitorReviews });
  } catch (e) {
    const message = e instanceof Error ? e.message : "detail query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
