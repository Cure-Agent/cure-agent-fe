# cure-agent-fe

한의사용 임상 어시스턴트 CureAgent의 프론트엔드. 지침 질의 3단 화면(대화·스트리밍 답변·인용 근거),
환자 관리, 임상 가이던스 검토, 대화 히스토리를 제공한다.
**설계 단일 원본은 [cure-agent-be/docs/architecture.md](https://github.com/Cure-Agent/cure-agent-be/blob/main/docs/architecture.md)**.

## 스택

Next.js 16 · React 19 · Tailwind CSS 4 · TanStack Query 5 · openapi-typescript/openapi-fetch(생성 타입) ·
vitest 4 + happy-dom + MSW

## 구동

```bash
pnpm install
pnpm dev            # http://localhost:3001 — /api/v1/*는 rewrites로 BE(3000) 프록시
```

BE는 [cure-agent-be README](https://github.com/Cure-Agent/cure-agent-be#구동)대로 먼저 띄운다.

## 계약 동기화 (§1)

API 타입은 손으로 쓰지 않는다 — `src/shared/api/generated/`는 BE의 `openapi/cure-agent.v1.json`에서 생성된다.

```bash
pnpm api:sync       # BE 스펙 가져와 재생성 (BE 레포가 형제 디렉토리에 있을 때)
pnpm api:generate   # 로컬 openapi/ 스냅샷 기준 재생성 (CI가 드리프트 0을 검사)
```

BE main 머지 시 repository_dispatch → Contract Sync 워크플로우가 동기화 PR을 자동 생성한다.

## 검증

```bash
pnpm typecheck && pnpm test && pnpm build
```

테스트는 vitest + MSW(수동 mock 금지). 수용 기준 테스트는 구현 전 동결(Codex 작성/Claude 리뷰·구현)한다.
