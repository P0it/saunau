"use client";

import { useEffect, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import type { Sauna } from "@/lib/data/types";
import { searchSaunas, getNewOpenings } from "@/lib/data/queries";
import { SaunaCard } from "@/components/sauna/SaunaCard";

const SUGGESTED = ["역삼동", "노천탕", "24시간", "세신"];

export default function SearchPage() {
  const [q, setQ] = useState("");
  const query = q.trim();

  const [results, setResults] = useState<Sauna[]>([]);
  const [searching, setSearching] = useState(false);
  const [suggested, setSuggested] = useState<Sauna[]>([]);

  // 추천 사우나(검색어 없을 때) — 새로 오픈 상위
  useEffect(() => {
    let alive = true;
    getNewOpenings(3)
      .then((rows) => alive && setSuggested(rows))
      .catch(() => alive && setSuggested([]));
    return () => {
      alive = false;
    };
  }, []);

  // 디바운스 검색 — searchSaunas("")는 []이라 빈 검색어도 동일 경로(동기 setState 회피).
  // '검색 중' 표시는 입력 핸들러(onChange)에서 켜고 결과 도착 시 끈다.
  useEffect(() => {
    let alive = true;
    const t = setTimeout(
      () => {
        searchSaunas(query, 40)
          .then((rows) => {
            if (alive) setResults(rows);
          })
          .catch(() => {
            if (alive) setResults([]);
          })
          .finally(() => {
            if (alive) setSearching(false);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const onQueryChange = (value: string) => {
    setQ(value);
    setSearching(value.trim().length > 0);
  };

  return (
    <div className="flex flex-col">
      <header className="flex flex-none items-center gap-[10px] px-[16px] pb-[12px] pt-[14px]">
        <div className="flex flex-1 items-center gap-[8px] rounded-full bg-card px-[14px] py-[11px] shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
          <SearchIcon size={18} className="text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="상호·지역·키워드 검색"
            className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
          />
          {q && (
            <button type="button" aria-label="지우기" onClick={() => onQueryChange("")}>
              <X size={16} className="text-muted" />
            </button>
          )}
        </div>
      </header>

      {!query ? (
        <div className="px-[20px] pt-[8px]">
          <div className="text-[13px] font-semibold text-muted">추천 검색어</div>
          <div className="mt-[12px] flex flex-wrap gap-[8px]">
            {SUGGESTED.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setQ(t)}
                className="rounded-full border border-line bg-card px-[13px] py-[7px] text-[13px] font-medium text-ink"
              >
                {t}
              </button>
            ))}
          </div>

          {suggested.length > 0 && (
            <>
              <div className="mt-[28px] text-[13px] font-semibold text-muted">
                추천 사우나
              </div>
              <div className="mt-[12px] flex flex-col gap-[14px] pb-[20px]">
                {suggested.map((s) => (
                  <SaunaCard key={s.id} sauna={s} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-[14px] px-[16px] pb-[20px]">
          {searching ? (
            <div className="py-[60px] text-center text-[14px] text-muted">
              검색 중…
            </div>
          ) : results.length === 0 ? (
            <div className="py-[60px] text-center text-[14px] text-muted">
              &lsquo;{query}&rsquo; 검색 결과가 없어요
            </div>
          ) : (
            results.map((s) => <SaunaCard key={s.id} sauna={s} />)
          )}
        </div>
      )}
    </div>
  );
}
