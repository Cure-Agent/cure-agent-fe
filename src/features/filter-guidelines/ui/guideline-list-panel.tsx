'use client';

import { FormEvent, useState } from 'react';
import { type GuidelineSummary, useGuidelines } from '../api/guideline.api';

export interface GuidelineListPanelProps {
  onSelect: (guideline: GuidelineSummary) => void;
}

export function GuidelineListPanel({ onSelect }: GuidelineListPanelProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | undefined>(undefined);
  const guidelines = useGuidelines({ query: submittedQuery });

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    setSubmittedQuery(input.trim() || undefined);
  };

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          aria-label="지침 검색"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="지침 제목 검색 (예: 요통)"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          검색
        </button>
      </form>

      {guidelines.isPending && <p className="text-sm text-gray-400">불러오는 중…</p>}
      {guidelines.isError && <p className="text-sm text-red-500">목록을 불러오지 못했습니다</p>}

      <ul className="flex-1 space-y-2 overflow-y-auto">
        {(guidelines.data?.items ?? []).map((guideline) => (
          <li key={guideline.id}>
            <button
              type="button"
              aria-label={guideline.title}
              onClick={() => onSelect(guideline)}
              className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-emerald-300"
            >
              <p className="font-medium text-gray-900">{guideline.title}</p>
              <p className="mt-1 text-xs text-gray-500">
                {guideline.publisher} · v{guideline.currentVersion} · {guideline.status}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
