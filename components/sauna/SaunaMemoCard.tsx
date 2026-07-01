"use client";

import { useState } from "react";
import { Lock, NotebookPen, Trash2 } from "lucide-react";
import { useRecords } from "@/lib/records";
import { LoginSheet } from "@/components/auth/LoginSheet";

/**
 * 상세 화면의 "내 메모" 진입점 — 사우나별 비공개 메모를 그 자리에서 바로 작성/수정.
 * 마이 '기록' 탭과 동일한 저장소(useRecords·localStorage)를 쓰므로 양쪽이 자동 동기화된다.
 * 후기(공개)와 달리 자물쇠 톤을 유지해 "나에게만 보인다"를 시각적으로 분리한다.
 */
export function SaunaMemoCard({ saunaId }: { saunaId: string }) {
  const { records, setRecord, removeRecord, userId } = useRecords();
  const note = records.find((r) => r.saunaId === saunaId)?.note ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [loginOpen, setLoginOpen] = useState(false);

  const startEdit = () => {
    if (!userId) {
      setLoginOpen(true);
      return;
    }
    setDraft(note);
    setEditing(true);
  };

  const save = () => {
    setRecord(saunaId, draft); // 빈 메모면 useRecords가 알아서 삭제 처리
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-[14px] border border-line bg-card p-[12px]">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
          placeholder="나만 보는 메모를 남겨보세요"
          className="w-full rounded-[10px] border border-line bg-[#FBFAF8] p-[10px] text-[14px] leading-[1.55] text-ink outline-none"
        />
        <div className="mt-[8px] flex justify-end gap-[8px]">
          <button
            type="button"
            onClick={() => {
              setDraft(note);
              setEditing(false);
            }}
            className="rounded-full px-[14px] py-[6px] text-[13px] font-semibold text-muted"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-full bg-brand px-[16px] py-[6px] text-[13px] font-semibold text-white"
          >
            저장
          </button>
        </div>
      </div>
    );
  }

  // 채워진 메모 — 클릭하면 편집. 자물쇠 톤으로 "나만 보임"을 표시.
  if (note) {
    return (
      <div className="flex items-start gap-[10px] rounded-[12px] border border-line bg-card px-[13px] py-[11px]">
        <button
          type="button"
          onClick={startEdit}
          className="flex-1 text-left"
        >
          <div className="mb-[3px] flex items-center gap-[5px] text-[11px] font-semibold text-[#9A938A]">
            <Lock size={11} />내 메모
          </div>
          <div className="text-[13px] leading-[1.5] text-[#46423E] text-pretty">
            {note}
          </div>
        </button>
        <button
          type="button"
          aria-label="메모 삭제"
          onClick={() => removeRecord(saunaId)}
          className="mt-[1px] flex-none text-[#C4BEB6] active:text-[#9A938A]"
        >
          <Trash2 size={15} />
        </button>
      </div>
    );
  }

  // 빈 상태 — 작은 한 줄 버튼(기본 정보를 밀어내지 않게 컴팩트).
  return (
    <>
      <button
        type="button"
        onClick={startEdit}
        className="flex h-[40px] w-full items-center gap-[7px] rounded-[12px] border border-dashed border-[#DAD6CF] bg-card px-[14px] text-[13px] font-semibold text-muted"
      >
        <NotebookPen size={15} />
        나만의 메모 남기기
        <Lock size={11} className="ml-auto text-dot" />
      </button>
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
