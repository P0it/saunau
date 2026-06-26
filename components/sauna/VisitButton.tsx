"use client";

import { useState } from "react";
import { CircleCheck, X } from "lucide-react";
import { useVisits } from "@/lib/visits";

/**
 * 다녀옴(3초 체크인) — 만족도 객관식 바텀시트.
 * v1: device 로컬 적재(다음 세션 Supabase visits로 교체). 태그·온도제보는 P1.
 */
export function VisitButton({ saunaId }: { saunaId: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const { addVisit } = useVisits();

  const submit = (s: "개운해요" | "평범해요" | "아쉬워요") => {
    addVisit(saunaId, s);
    setDone(true);
    setTimeout(() => {
      setOpen(false);
      setDone(false);
    }, 900);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[52px] flex-1 items-center justify-center gap-[6px] rounded-[16px] bg-brand text-[15px] font-semibold text-white"
      >
        <CircleCheck size={20} />
        다녀옴
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 mx-auto flex max-w-[430px] flex-col justify-end bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-t-[24px] bg-card p-[22px] pb-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="flex flex-col items-center py-[20px]">
                <CircleCheck size={40} className="text-brand" />
                <p className="mt-[10px] text-[15px] font-semibold text-ink">
                  기록됐어요
                </p>
              </div>
            ) : (
              <>
                <div className="mb-[14px] flex items-center justify-between">
                  <span className="text-[17px] font-bold text-ink">
                    다녀오셨나요?
                  </span>
                  <button type="button" aria-label="닫기" onClick={() => setOpen(false)}>
                    <X size={22} className="text-muted" />
                  </button>
                </div>
                <div className="flex gap-[8px]">
                  {(["개운해요", "평범해요", "아쉬워요"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="flex-1 rounded-[14px] border border-line bg-card py-[14px] text-[14px] font-semibold text-ink active:bg-[#FDECE9]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-[14px] text-center text-[12px] text-muted">
                  키워드 태그·온도 제보는 다음 업데이트에서 제공돼요
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
