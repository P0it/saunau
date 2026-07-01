import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 현재 세션이 관리자인지 여부만 내려준다(허용목록은 노출하지 않음).
 * 클라이언트가 관리자 전용 컨트롤(사진 숨기기 등) 노출 여부를 결정할 때 사용.
 * GET /api/admin/me → { isAdmin: boolean }
 */
export async function GET() {
  const user = await getAdminUser();
  return NextResponse.json({ isAdmin: !!user });
}
