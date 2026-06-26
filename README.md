This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 매장 사진·블로그 후기 (수집 / 킬스위치 / 퍼지)

사진·후기는 `supabase/migrations/0002_photos_reviews.sql` 적용 + `sauna-photos` 버킷이 필요하다.
모든 사진은 우리 Storage 에서만 서빙되며(외부 URL 노출 0), 출처/원본URL은 서버 전용이다.

```bash
# 수집(수동 백필 — 공공데이터 Cron 과 분리)
pnpm crawl:naver -- --limit 20            # 블로그 후기만(네이버 공식 API, 합법)
pnpm crawl:naver -- --limit 20 --photos   # 사진까지(비공식 플레이스 — place.ts 라이브 검증 필요)

# 런타임 킬스위치(재배포 없이, 최대 30초 내 반영)
pnpm flag images_enabled off              # 전 앱 사진 OFF → plain card
pnpm flag blog_reviews_enabled off        # 블로그 후기 섹션 OFF
pnpm flag list                            # 현재 플래그 값
```

비상 퍼지(크롤 자산만 영구 삭제, 우리 자산 owner/editor 는 보존):

```sql
delete from sauna_photos where source = 'naver_crawl';
update saunas set thumbnail_url = null, thumbnail_source = null
  where thumbnail_source = 'naver_crawl';
-- + Storage sauna-photos 버킷의 해당 객체 삭제
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
