import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ArticleBody } from "@/components/magazine/ArticleBody";

/**
 * 약관·방침 공통 화면. 본문 렌더러는 매거진의 ArticleBody 를 그대로 재사용한다
 * (표·목록·제목 매핑이 이미 디자인 토큰에 맞춰져 있음).
 */
export function LegalScreen({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-full shrink-0 flex-col bg-white">
      <ScreenHeader title={title} className="bg-white/90" />
      <div className="px-[20px] pb-[40px] pt-[10px]">
        <ArticleBody body={body} />
      </div>
    </div>
  );
}
