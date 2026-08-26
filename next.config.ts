import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel Image Optimization 을 태우지 않는다 — 저장 시점에 이미 끝냈기 때문.
    // lib/ingest/naver/store.ts 의 PROFILES 가 수집 단계에서 sharp 로
    // WebP + 렌더 폭(gallery 720 / thumb 160)까지 맞춰 저장한다.
    // 그걸 Vercel 이 한 번 더 리사이즈·재인코딩하면 얻는 것 없이 변환 과금만 는다
    // (변환은 cache MISS 마다 1건, 캐시 키에 width·quality 가 들어가서
    //  sizes 가 화면마다 다른 만큼 같은 사진이 여러 번 잡힌다 — Hobby 한도 5K/월).
    // ⚠ unoptimized 가 켜지면 /_next/image 를 안 거치므로
    //   아래 remotePatterns 는 더 이상 강제되지 않는다(옵티마이저가 검사하는 목록이다).
    //   살아있는 방어선은 서버 질의 계층이다 — 우리 Storage URL 만 내린다
    //   (components/sauna/SaunaImage.tsx 주석 참고). remotePatterns 는
    //   unoptimized 를 다시 끄는 날을 위해 남겨둔다.
    unoptimized: true,
    // 사진은 전부 우리 Supabase Storage 에서만 서빙한다.
    // pstatic.net·네이버 등 제3자 호스트는 절대 등록하지 않음 →
    // 옵티마이저를 다시 켜면 외부 이미지가 구조적으로 렌더 불가
    // (= saunaday 의 핫링크 유출 사고 차단).
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
