import { redirect } from "next/navigation";

/** 찜/다녀옴은 마이 탭(/my)으로 통합. 구 경로는 리다이렉트. */
export default function FavoritesRedirect() {
  redirect("/my");
}
