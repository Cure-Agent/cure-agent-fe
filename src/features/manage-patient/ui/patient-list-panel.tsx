'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useInfiniteListScroll } from '@/shared/lib/use-infinite-list-scroll';
import {
  type PatientSummary,
  useArchivePatient,
  usePatients,
  useUnarchivePatient,
} from '../api/patient.api';

export interface PatientListPanelProps {
  onSelect: (patient: PatientSummary) => void;
}

type IconProps = { className?: string };

function iconSvg(children: React.ReactNode) {
  return function Icon({ className }: IconProps): React.ReactElement {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
      >
        {children}
      </svg>
    );
  };
}

const ArchiveIcon = iconSvg(
  <>
    <rect x="2" y="3" width="20" height="5" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </>,
);

const UnarchiveIcon = iconSvg(
  <>
    <rect x="2" y="3" width="20" height="5" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M12 17v-5" />
    <path d="m9.5 14.5 2.5-2.5 2.5 2.5" />
  </>,
);

const ACTION_BUTTON =
  'rounded-md p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50';

/**
 * 행마다 훅 인스턴스가 필요하다 — useArchivePatient은 patientId를 호출 시점에 묶는데
 * 이 목록엔 대화 목록 같은 '선택된 행' 개념이 없다.
 *
 * 접근성 이름에 caseLabel을 붙여야 목록에 같은 이름의 버튼이 N개 생기지 않는다.
 */
function PatientArchiveAction({
  patient,
  onArchived,
}: {
  patient: PatientSummary;
  onArchived: (patient: PatientSummary) => void;
}): React.ReactElement {
  const archivePatient = useArchivePatient(patient.id);
  const unarchivePatient = useUnarchivePatient(patient.id);

  if (patient.status === 'ARCHIVED') {
    return (
      <button
        type="button"
        onClick={() => unarchivePatient.mutate()}
        disabled={unarchivePatient.isPending}
        aria-label={`${patient.caseLabel} 보관 해제`}
        title="보관 해제"
        className={ACTION_BUTTON}
      >
        <UnarchiveIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => archivePatient.mutate(undefined, { onSuccess: () => onArchived(patient) })}
      disabled={archivePatient.isPending}
      aria-label={`${patient.caseLabel} 보관`}
      title="보관"
      className={ACTION_BUTTON}
    >
      <ArchiveIcon className="h-4 w-4" />
    </button>
  );
}

/** 활성 필터에서 보관하면 그 행은 즉시 사라진다 — 되돌릴 자리를 잃지 않도록 남겨둔다 */
function UndoArchiveBanner({
  patient,
  onUndone,
}: {
  patient: { id: string; caseLabel: string };
  onUndone: () => void;
}): React.ReactElement {
  const unarchivePatient = useUnarchivePatient(patient.id);
  return (
    <div className="mb-3 flex shrink-0 items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-2">
      <p className="min-w-0 flex-1 truncate text-xs text-gray-600">
        <span className="font-medium text-gray-800">{patient.caseLabel}</span> 보관됨
      </p>
      <button
        type="button"
        onClick={() => unarchivePatient.mutate(undefined, { onSuccess: onUndone })}
        disabled={unarchivePatient.isPending}
        className="shrink-0 text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
      >
        되돌리기
      </button>
    </div>
  );
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'ARCHIVED';

/** 라벨·크기는 대화 목록(ConversationList)의 세그먼트를 따른다 — 순서만 이 화면의 기본값에 맞춘다 */
const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '활성' },
  { value: 'ARCHIVED', label: '보관됨' },
];

export function PatientListPanel({ onSelect }: PatientListPanelProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | undefined>(undefined);
  // 기본 전체 — 활성만 보이는 기본값은 보관 환자가 검색에서 조용히 빠지는 실패 모드를 만든다
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [justArchived, setJustArchived] = useState<{ id: string; caseLabel: string } | null>(null);
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

  // 배너는 방금 한 동작에 대한 확인이다 — 목록이 다른 조건으로 바뀌면 맥락을 잃으므로 함께 지운다
  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    setSubmittedQuery(input.trim() || undefined);
    setJustArchived(null);
  };

  const handleFilterChange = (next: StatusFilter): void => {
    setStatusFilter(next);
    setJustArchived(null);
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
        className="mb-3 flex w-fit shrink-0 rounded-lg border border-gray-200 bg-gray-100 p-0.5"
      >
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={statusFilter === filter.value}
            onClick={() => handleFilterChange(filter.value)}
            className={`rounded-md px-2 py-1 text-xs ${
              statusFilter === filter.value
                ? 'bg-white font-medium text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {justArchived && (
        <UndoArchiveBanner patient={justArchived} onUndone={() => setJustArchived(null)} />
      )}

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
              {/* 카드 버튼 안에 액션 버튼을 넣을 수 없다(중첩 인터랙티브) — 형제로 나란히 둔다 */}
              <div className="flex items-center rounded-xl border border-gray-200 bg-white hover:border-emerald-300">
                <button
                  type="button"
                  aria-label={patient.caseLabel}
                  onClick={() => onSelect(patient)}
                  className="min-w-0 flex-1 p-4 text-left"
                >
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{patient.caseLabel}</p>
                    {patient.status === 'ARCHIVED' && (
                      <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
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
                <div className="shrink-0 pr-3">
                  <PatientArchiveAction patient={patient} onArchived={setJustArchived} />
                </div>
              </div>
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
