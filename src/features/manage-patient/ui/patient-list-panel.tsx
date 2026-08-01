'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useInfiniteListScroll } from '@/shared/lib/use-infinite-list-scroll';
import { type PatientSummary, usePatients } from '../api/patient.api';

export interface PatientListPanelProps {
  onSelect: (patient: PatientSummary) => void;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'ARCHIVED';

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '활성' },
  { value: 'ARCHIVED', label: '보관' },
];

export function PatientListPanel({ onSelect }: PatientListPanelProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | undefined>(undefined);
  // 기본 전체 — 활성만 보이는 기본값은 보관 환자가 검색에서 조용히 빠지는 실패 모드를 만든다
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const patients = usePatients({
    query: submittedQuery,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  });

  const items = useMemo(
    () => (patients.data?.pages ?? []).flatMap((page) => page.items),
    [patients.data],
  );
  const listScroll = useInfiniteListScroll({
    hasNext: patients.hasNextPage ?? false,
    isFetching: patients.isFetchingNextPage,
    fetchNext: () => void patients.fetchNextPage(),
    itemCount: items.length,
  });

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    setSubmittedQuery(input.trim() || undefined);
  };

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={handleSubmit} className="mb-2 flex gap-2">
        <input
          aria-label="환자 검색"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="케이스 라벨 검색 (예: CASE-001)"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          검색
        </button>
      </form>

      <div
        role="group"
        aria-label="보관 상태 필터"
        className="mb-4 flex w-fit rounded-lg border border-gray-200 bg-gray-100 p-0.5"
      >
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={statusFilter === filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`rounded-md px-3 py-1 text-sm ${
              statusFilter === filter.value
                ? 'bg-white font-medium text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {patients.isPending && <p className="text-sm text-gray-400">불러오는 중…</p>}
      {patients.isError && <p className="text-sm text-red-500">목록을 불러오지 못했습니다</p>}

      <div
        ref={listScroll.containerRef}
        onScroll={listScroll.handleScroll}
        className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto"
      >
        <ul className="space-y-2">
          {items.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                aria-label={patient.caseLabel}
                onClick={() => onSelect(patient)}
                className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-emerald-300"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{patient.caseLabel}</p>
                  {patient.status === 'ARCHIVED' && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      보관됨
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {patient.age !== undefined && `${patient.age}세`}
                  {patient.sex && ` · ${patient.sex}`}
                  {patient.bmi !== undefined && ` · BMI ${patient.bmi}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
        {/* 하단 sentinel — 보이면 다음 페이지를 당긴다 (무한 스크롤) */}
        <div ref={listScroll.bottomSentinelRef} aria-hidden="true" />
        {patients.isFetchingNextPage && (
          <p className="py-2 text-center text-xs text-gray-400">불러오는 중…</p>
        )}
      </div>
    </div>
  );
}
