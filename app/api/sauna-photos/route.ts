import { NextResponse, type NextRequest } from "next/server";
import { getSaunaPhotos } from "@/lib/data/queries";

export const dynamic = "force-dynamic"; // 사진 정책(킬스위치) 항상 최신 반영

/**
 * 지도 상세 패널의 히어로 갤러리용 — 사진만.
 *
 * 후기(블로그·방문자)와 한 응답으로 묶으면 화면 맨 위의 사진이 가장 느린 쿼리를
 * 기다리게 된다. 사진은 패널을 열자마자 보이는 요소라 따로 뗐다.
 * 후기는 /api/sauna-detail 이 계속 담당한다(두 요청은 클라이언트에서 병렬).
 *
 * GET /api/sauna-photos?id=<saunaId>
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    return NextResponse.json({ photos: await getSaunaPhotos(id) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "photo query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
