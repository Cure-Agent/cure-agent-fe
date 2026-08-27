# CureAgent Frontend

[English](README.md) | [한국어](README.ko.md)

Frontend application for CureAgent, a clinical RAG assistant that retrieves
evidence from medical guidelines and generates citation-grounded answers.

**Live Demo:** [cure.demo01.xyz](https://cure.demo01.xyz)

The backend is the source of truth for the system design. See the
[CureAgent architecture](https://github.com/Cure-Agent/cure-agent-be/blob/main/docs/architecture.md)
for the RAG pipeline and service boundaries.

## Features

- Streaming clinical Q&A
- Citation and evidence viewer
- Patient management
- Clinical guidance review
- Conversation history

## Tech Stack

Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS 4 · TanStack Query 5 ·
openapi-typescript · openapi-fetch

## Getting Started

Requires Node.js 22+ and pnpm 10. Start the
[CureAgent backend](https://github.com/Cure-Agent/cure-agent-be) first.

```bash
pnpm install
pnpm dev  # http://localhost:3001; /api/v1/* proxies to the backend on port 3000
```

## API Contract Synchronization

API types are generated from the backend OpenAPI specification rather than written
by hand.

```bash
pnpm api:sync      # Fetch the backend specification and regenerate types
pnpm api:generate  # Regenerate types from the committed local snapshot
```

- Generated types live in `src/shared/api/generated/`.
- CI regenerates the client and verifies zero drift in the OpenAPI snapshot and
  generated types.
- A backend `main` merge dispatches the Contract Sync workflow, which automatically
  opens or updates a synchronization PR.

## Testing

Vitest · MSW · Testing Library · Playwright

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Vitest tests use MSW at the network boundary. Playwright covers critical browser
flows against deterministic API stubs.
