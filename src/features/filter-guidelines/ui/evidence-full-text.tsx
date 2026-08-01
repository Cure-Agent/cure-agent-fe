'use client';

import { useEvidenceDetail } from '../api/guideline.api';

export interface EvidenceFullTextProps {
  /** EvidenceChunk id — GET /evidence/{id} */
  evidenceId: string;
}

/**
 * 근거 청크 전문 — 권고문 원문·본문 발췌·원문 페이지.
 * 지침 상세·인용 근거 패널·임상 참고안이 같은 구성을 공유한다.
 * 마운트 시점에 조회하므로 펼침(expanded) 상태에서만 렌더할 것.
 */
export function EvidenceFullText({ evidenceId }: EvidenceFullTextProps): React.ReactElement {
  const detail = useEvidenceDetail(evidenceId);

  if (detail.isPending) return <p className="text-sm text-gray-400">전문 불러오는 중…</p>;
  if (detail.isError || !detail.data) {
    return <p className="text-sm text-red-500">전문을 불러오지 못했습니다</p>;
  }

  const data = detail.data;
  return (
    <div className="space-y-3">
      {data.recommendationText && (
        <div>
          <h3 className="text-xs font-semibold text-gray-900">권고문 원문</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-800">
            {data.recommendationText}
          </p>
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold text-gray-900">본문 발췌</h3>
        <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{data.excerpt}</p>
      </div>
      {data.pageStart !== undefined && (
        <p className="text-xs text-gray-500">
          원문 p.{data.pageStart}
          {data.pageEnd !== undefined &&
            data.pageEnd !== data.pageStart &&
            `–${data.pageEnd}`}
        </p>
      )}
    </div>
  );
}
