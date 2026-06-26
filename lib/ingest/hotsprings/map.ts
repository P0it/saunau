/**
 * HotSpringApiItem → HotSpringRow.
 * 위경도(lat/lot)는 이미 WGS84 → TM 변환 없이 그대로 EWKT.
 */
import type { LngLat } from "../projection";
import { toEwkt } from "../projection";
import type { HotSpringApiItem, HotSpringRow } from "./types";

function num(s: string | null | undefined): number | null {
  const v = parseFloat((s ?? "").trim());
  return isFinite(v) ? v : null;
}

function wgs84(latStr: string | null, lotStr: string | null): LngLat | null {
  const lat = num(latStr);
  const lng = num(lotStr);
  if (lat === null || lng === null) return null;
  if (lng < 124 || lng > 132 || lat < 33 || lat > 39.5) return null;
  return { lng, lat };
}

export function mapHotSpring(item: HotSpringApiItem): HotSpringRow {
  const road = (item.lctnRoadNmAddr ?? "").trim();
  const lotno = (item.lctnLotnoAddr ?? "").trim();
  const year = num(item.dsgnYr);
  const wells = num(item.htwlCnt);

  return {
    name: (item.htspNm ?? "").trim(),
    sido: (item.ctpvNm ?? "").trim() || null,
    sigungu: (item.sggNm ?? "").trim() || null,
    address: road || lotno || null,
    location: toEwkt(wgs84(item.lat, item.lot)),
    source_temp: num(item.htspTp),
    spring_quality: (item.htspQlty ?? "").trim() || null,
    composition: (item.htspIgrdNm ?? "").trim() || null,
    well_count: wells === null ? null : Math.round(wells),
    depth: num(item.dpth),
    designated_year: year === null ? null : Math.round(year),
    manager_org: (item.mngInstNm ?? "").trim() || null,
    manager_tel: (item.mngInstTelno ?? "").trim() || null,
    data_base_date: (item.dataCrtrYmd ?? "").trim() || null,
  };
}
