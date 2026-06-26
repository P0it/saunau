import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 사진은 전부 우리 Supabase Storage 에서만 서빙한다.
    // pstatic.net·네이버 등 제3자 호스트는 절대 등록하지 않음 →
    // 외부 이미지가 구조적으로 렌더 불가(= saunaday 의 핫링크 유출 사고 차단).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
