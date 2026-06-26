/**
 * LOCALDATA 좌표는 WGS84 가 아니라 TM(EPSG:5174, Korea 2000 / Central Belt, Bessel)이다.
 * proj4 로 5174 → 4326(위경도) 재투영한다. 좌표 결측/이상치는 null 반환.
 */
import proj4 from "proj4";

// EPSG:5174 정의 (LOCALDATA 표준 좌표계)
const EPSG_5174 =
  "+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 " +
  "+ellps=bessel +units=m +no_defs " +
  "+towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43";

proj4.defs("EPSG:5174", EPSG_5174);

export interface LngLat {
  lng: number;
  lat: number;
}

/** 한국 영역 대략 경계(이상치 컷). */
function inKorea(lng: number, lat: number): boolean {
  return lng >= 124 && lng <= 132 && lat >= 33 && lat <= 39.5;
}

/**
 * TM(5174) X/Y 문자열 → {lng, lat}. 변환 실패·범위 밖이면 null.
 */
export function tmToWgs84(
  xStr: string | null | undefined,
  yStr: string | null | undefined,
): LngLat | null {
  const x = parseFloat((xStr ?? "").trim());
  const y = parseFloat((yStr ?? "").trim());
  if (!isFinite(x) || !isFinite(y) || x === 0 || y === 0) return null;
  try {
    const [lng, lat] = proj4("EPSG:5174", "EPSG:4326", [x, y]);
    if (!inKorea(lng, lat)) return null;
    return { lng, lat };
  } catch {
    return null;
  }
}

/** geography(Point,4326) 입력용 EWKT 문자열. */
export function toEwkt(p: LngLat | null): string | null {
  return p ? `SRID=4326;POINT(${p.lng} ${p.lat})` : null;
}
