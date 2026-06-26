/**
 * PostgREST 는 geography(Point,4326) 컬럼을 EWKB hex 문자열로 반환한다
 * (예: "0101000020E6100000...X...Y..."). 이를 {lat,lng} 로 디코딩한다.
 * 형식: [1B endian][4B type(+SRID flag)][4B SRID?][8B X(lng)][8B Y(lat)]
 */
import type { GeoPoint } from "@/lib/data/types";

export function parseEwkbPoint(hex: string | null | undefined): GeoPoint | null {
  if (!hex || hex.length < 42) return null;
  try {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    const dv = new DataView(bytes.buffer);
    const littleEndian = bytes[0] === 1;
    const type = dv.getUint32(1, littleEndian);
    let offset = 5;
    if (type & 0x20000000) offset += 4; // SRID 플래그면 SRID 4바이트 건너뜀
    const lng = dv.getFloat64(offset, littleEndian);
    const lat = dv.getFloat64(offset + 8, littleEndian);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
