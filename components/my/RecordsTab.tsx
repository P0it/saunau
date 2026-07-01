"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, Plus, Search, X, Trash2, NotebookPen } from "lucide-react";
import { CATEGORY_LABEL, primaryCategory, type Sauna } from "@/lib/data/types";
import { useRecords, type RecordNote } from "@/lib/records";
import { getSaunasByIds, searchSaunas } from "@/lib/data/queries";
import { SaunaImage } from "@/components/sauna/SaunaImage";
import { saunaHref } from "@/components/sauna/SaunaCard";
import { LoginSheet } from "@/components/auth/LoginSheet";

/**
 * 나의 기록 탭 — 후기와 분리된 비공개 사우나별 메모의 "모아보기".
 * 작성은 여기(검색 시트로 사우나 선택)와 상세 화면의 SaunaMemoCard 양쪽에서 하며,
 * 같은 저장소(useRecords)를 공유해 자동 동기화된다.
 */
export function RecordsTab() {
  const { records, setRecord, removeRecord, userId, loading } = useRecords();
  const [byId, setById] = useState<Map<string, Sauna>>(new Map());
  const [picking, setPicking] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const ids = useMemo(() => records.map((r) => r.saunaId), [records]);

  useEffect(() => {
    let alive = true;
    getSaunasByIds(ids)
      .then((rows) => {
        if (alive) setById(new Map(rows.map((s) => [s.id, s])));
      })
      .catch(() => {
        if (alive) setById(new Map());
      });
    return () => {
      alive = false;
    };
  }, [ids]);

  if (loading) return null;

  if (!userId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center px-[20px] py-[80px] text-center">
          <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#F2F1EF]">
            <Lock size={34} className="text-muted" />
          </div>
          <p className="mt-[18px] text-[15px] font-semibold text-ink">
            로그인하면 나만의 기록을 남길 수 있어요
          </p>
          <p className="mt-[6px] text-[13px] text-muted">
            남긴 메모는 어디서 접속해도 그대로예요
          </p>
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="mt-[20px] rounded-full bg-brand px-[20px] py-[11px] text-[14px] font-semibold text-white"
          >
            로그인
          </button>
        </div>
        <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    );
  }

  if (records.length === 0) {
    return (
      <>
        <RecordsEmpty onAdd={() => setPicking(true)} />
        {picking && (
          <RecordPicker
            onClose={() => setPicking(false)}
            onSave={(saunaId, note) => {
              setRecord(saunaId, note);
              setPicking(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-[14px] px-[16px] pb-[24px]">
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="flex h-[46px] items-center justify-center gap-[6px] rounded-[14px] border border-dashed border-[#DAD6CF] bg-card text-[14px] font-semibold text-muted"
      >
        <Plus size={17} />
        새 기록 추가
      </button>

      {records.map((rec) => {
        const s = byId.get(rec.saunaId);
        if (!s) return null;
        return (
          <RecordCard
            key={rec.saunaId}
            sauna={s}
            record={rec}
            onSave={(note) => setRecord(rec.saunaId, note)}
            onRemove={() => removeRecord(rec.saunaId)}
          />
        );
      })}

      {picking && (
        <RecordPicker
          onClose={() => setPicking(false)}
          onSave={(saunaId, note) => {
            setRecord(saunaId, note);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function RecordsEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-[20px] py-[80px] text-center">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#F2F1EF]">
        <NotebookPen size={36} className="text-muted" />
      </div>
      <p className="mt-[18px] text-[15px] font-semibold text-ink">
        나만 보는 기록을 남겨보세요
      </p>
      <p className="mt-[6px] text-[13px] text-muted">
        사우나별로 메모할 수 있어요 · 나에게만 보여요
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-[20px] flex items-center gap-[6px] rounded-full bg-brand px-[20px] py-[11px] text-[14px] font-semibold text-white"
      >
        <Plus size={16} />
        기록 추가
      </button>
    </div>
  );
}

function formatUpdated(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${Number(m)}월 ${Number(d)}일 기록`;
}

function RecordCard({
  sauna,
  record,
  onSave,
  onRemove,
}: {
  sauna: Sauna;
  record: RecordNote;
  onSave: (note: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(record.note);
  const cat = CATEGORY_LABEL[primaryCategory(sauna)];

  return (
    <div className="rounded-[16px] border border-line bg-card p-[14px]">
      <div className="flex items-center gap-[11px]">
        <Link
          href={saunaHref(sauna)}
          className="relative h-[52px] w-[52px] flex-none overflow-hidden rounded-[12px] bg-[#EEF0F2]"
        >
          <SaunaImage
            src={sauna.thumbnail_url}
            alt={sauna.name}
            sizes="52px"
            iconSize={22}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={saunaHref(sauna)} className="flex items-center gap-[6px]">
            <span className="truncate text-[15px] font-semibold text-ink">
              {sauna.name}
            </span>
            <span className="flex-none rounded-[6px] border border-[#E6E6E9] px-[6px] py-[1px] text-[11px] font-semibold text-muted">
              {cat}
            </span>
          </Link>
          <div className="mt-[3px] text-[12px] text-muted tabular-nums">
            {formatUpdated(record.updatedAt)}
          </div>
        </div>
        <button
          type="button"
          aria-label="기록 삭제"
          onClick={onRemove}
          className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[#B9B3AB] active:bg-[#F2F1EF]"
        >
          <Trash2 size={17} />
        </button>
      </div>

      {editing ? (
        <div className="mt-[11px]">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            placeholder="나만 보는 메모를 남겨보세요"
            className="w-full rounded-[12px] border border-line bg-[#FBFAF8] p-[12px] text-[13px] leading-[1.55] text-ink outline-none"
          />
          <div className="mt-[8px] flex justify-end gap-[8px]">
            <button
              type="button"
              onClick={() => {
                setDraft(record.note);
                setEditing(false);
              }}
              className="rounded-full px-[14px] py-[7px] text-[13px] font-semibold text-muted"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
              className="rounded-full bg-brand px-[16px] py-[7px] text-[13px] font-semibold text-white"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(record.note);
            setEditing(true);
          }}
          className="mt-[11px] block w-full rounded-[12px] bg-[#F7F6F4] p-[11px_13px] text-left"
        >
          <div className="mb-[5px] flex items-center gap-[5px] text-[11px] font-semibold text-[#9A938A]">
            <Lock size={12} />
            나만의 메모
          </div>
          <div className="text-[13px] leading-[1.55] text-[#46423E] text-pretty">
            {record.note}
          </div>
        </button>
      )}
    </div>
  );
}

/** 사우나 검색 → 선택 → 메모 작성 바텀시트. */
function RecordPicker({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (saunaId: string, note: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Sauna[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Sauna | null>(null);
  const [draft, setDraft] = useState("");
  const { records } = useRecords();

  // 검색 디바운스(외부 의존 없이 setTimeout). 최신 입력만 반영.
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let alive = true;
    const t = setTimeout(() => {
      searchSaunas(term, 20)
        .then((rows) => {
          if (alive) setResults(rows);
        })
        .catch(() => {
          if (alive) setResults([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex max-w-[430px] flex-col justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex max-h-[82vh] flex-col rounded-t-[24px] bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-[20px] pb-[12px] pt-[18px]">
          <span className="text-[17px] font-bold text-ink">
            {picked ? picked.name : "어떤 사우나를 기록할까요?"}
          </span>
          <button type="button" aria-label="닫기" onClick={onClose}>
            <X size={22} className="text-muted" />
          </button>
        </div>

        {picked ? (
          <div className="px-[20px] pb-[24px]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              autoFocus
              placeholder="나만 보는 메모를 남겨보세요"
              className="w-full rounded-[12px] border border-line bg-[#FBFAF8] p-[12px] text-[14px] leading-[1.55] text-ink outline-none"
            />
            <div className="mt-[12px] flex gap-[8px]">
              <button
                type="button"
                onClick={() => {
                  setPicked(null);
                  setDraft("");
                }}
                className="rounded-full px-[16px] py-[11px] text-[14px] font-semibold text-muted"
              >
                뒤로
              </button>
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={() => onSave(picked.id, draft)}
                className="flex-1 rounded-[14px] bg-brand py-[13px] text-[15px] font-semibold text-white disabled:opacity-40"
              >
                기록 저장
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-[20px]">
              <div className="flex h-[46px] items-center gap-[8px] rounded-[14px] bg-[#F3F3F5] px-[14px]">
                <Search size={18} className="text-muted" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoFocus
                  placeholder="사우나·지역 검색"
                  className="h-full flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
                />
              </div>
            </div>
            <div className="mt-[10px] min-h-[160px] flex-1 overflow-y-auto px-[12px] pb-[20px]">
              {loading ? (
                <p className="py-[40px] text-center text-[13px] text-muted">
                  검색 중…
                </p>
              ) : q.trim() && results.length === 0 ? (
                <p className="py-[40px] text-center text-[13px] text-muted">
                  검색 결과가 없어요
                </p>
              ) : !q.trim() ? (
                <p className="py-[40px] text-center text-[13px] text-muted">
                  사우나 이름이나 지역을 검색하세요
                </p>
              ) : (
                results.map((s) => {
                  const has = records.some((r) => r.saunaId === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setPicked(s);
                        setDraft(
                          records.find((r) => r.saunaId === s.id)?.note ?? "",
                        );
                      }}
                      className="flex w-full items-center gap-[11px] rounded-[12px] px-[8px] py-[9px] text-left active:bg-[#F7F6F4]"
                    >
                      <span className="relative h-[44px] w-[44px] flex-none overflow-hidden rounded-[10px] bg-[#EEF0F2]">
                        <SaunaImage
                          src={s.thumbnail_url}
                          alt={s.name}
                          sizes="44px"
                          iconSize={18}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ink">
                          {s.name}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {s.sigungu} {s.dong}
                        </span>
                      </span>
                      {has && (
                        <span className="flex-none rounded-full bg-[#FDECE9] px-[8px] py-[3px] text-[11px] font-semibold text-brand">
                          기록 있음
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
