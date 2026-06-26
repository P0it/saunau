/**
 * 온천 교차링크 실행. saunas 의 is_hot_spring/verified_hot_spring 를
 * 등록 온천 반경(기본 500m) 인근 영업장에 덧칠한다.
 * 실제 공간연산은 DB RPC(link_verified_hot_springs)가 수행.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function linkVerifiedHotSprings(
  supabase: SupabaseClient,
  radiusM = 500,
): Promise<number> {
  const { data, error } = await supabase.rpc("link_verified_hot_springs", {
    radius_m: radiusM,
  });
  if (error) throw new Error(`교차링크 실패: ${error.message}`);
  return (data as number) ?? 0;
}
