# CureAgent Frontend

[English](README.md) | [한국어](README.ko.md)

CureAgent의 프론트엔드 애플리케이션. CureAgent는 의료 가이드라인에서 근거를 검색하고
인용에 기반한 답변을 생성하는 임상 RAG 어시스턴트다.

**Live Demo:** [cure.demo01.xyz](https://cure.demo01.xyz)

시스템 설계의 단일 원본은 백엔드다. RAG 파이프라인과 서비스 경계는
[CureAgent architecture](https://github.com/Cure-Agent/cure-agent-be/blob/main/docs/architecture.md)를
참고한다.

## 주요 기능

- 스트리밍 임상 질의응답
- 인용 및 근거 뷰어
- 환자 관리
- 임상 가이던스 검토
- 대화 기록

## 기술 스택

Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS 4 · TanStack Query 5 ·
openapi-typescript · openapi-fetch

## 시작하기

Node.js 22+와 pnpm 10이 필요하다. 먼저
[CureAgent 백엔드](https://github.com/Cure-Agent/cure-agent-be)를 실행한다.

```bash
pnpm install
pnpm dev  # http://localhost:3001; /api/v1/* 요청을 3000번 포트의 백엔드로 프록시
```

## API 계약 동기화

API 타입은 손으로 작성하지 않고 백엔드 OpenAPI 명세에서 생성한다.

```bash
pnpm api:sync      # 백엔드 명세를 가져와 타입 재생성
pnpm api:generate  # 커밋된 로컬 스냅샷에서 타입 재생성
```

- 생성된 타입은 `src/shared/api/generated/`에 둔다.
- CI는 클라이언트를 다시 생성하고 OpenAPI 스냅샷과 생성 타입에 차이가 없는지 검증한다.
- 백엔드 `main` merge는 Contract Sync 워크플로우를 트리거하며, 이 워크플로우가 동기화 PR을
  자동으로 열거나 갱신한다.

## 테스트

Vitest · MSW · Testing Library · Playwright

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Vitest 테스트는 네트워크 경계에서 MSW를 사용한다. Playwright는 결정적인 API 스텁을 통해
핵심 브라우저 흐름을 검증한다.
