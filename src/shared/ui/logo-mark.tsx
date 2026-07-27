/**
 * Cure Agent 마크. 열린 원(C)을 파형이 가로지른 뒤 원 밖의 점 위에서 멈추고,
 * 그 점이 인용(근거)을 뜻한다 — 파형과 점의 간격이 개념의 핵심이라 바꾸지 않는다.
 *
 * 색은 `currentColor`를 상속하므로 `text-emerald-700` 같은 유틸리티로 제어한다.
 * 마크만 단독으로 놓을 때는 `aria-hidden`을 끄고 이름을 노출할 것.
 */
export function LogoMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 96.02 83.68"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M69.912 67.027 A37.715 37.715 0 1 1 69.912 16.653" strokeWidth="8.25" />
        <path
          d="M25.278 41.840 L47.778 41.840 L52.528 27.652 L59.403 60.652 L65.403 41.840 L88.966 41.840"
          strokeWidth="5.85"
        />
      </g>
      <circle cx="88.966" cy="41.840" r="7.05" fill="currentColor" />
    </svg>
  );
}
