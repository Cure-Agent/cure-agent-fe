/**
 * 에디터 전용 `cure-agent-fe` 모듈 셰이프.
 *
 * 프리뷰(`.design-sync/previews/*.tsx`)는 패키지 이름 `cure-agent-fe` 로 import 한다 —
 * 컨버터가 만드는 번들에서는 `entry.ts` 와 `cfg.extraEntries`(process-shim, provider)의
 * export 가 하나의 전역(`window.CureAgentFe`)으로 합쳐지기 때문이다. 하지만 이 레포는
 * 자기 자신을 `node_modules/cure-agent-fe` 로 갖고 있지 않아, 에디터의 TS 서비스에는
 * 그 모듈이 존재하지 않는다 (TS2307).
 *
 * 이 파일은 그 합집합을 타입 레벨에서 재현해 `.design-sync/tsconfig.json` 의
 * `paths["cure-agent-fe"]` 가 가리키게 한 것이다. **런타임·번들과는 무관하다.**
 * `cfg.extraEntries` 나 `--entry` 에 이 파일을 넣지 말 것 — 스타 export 가 겹쳐
 * esbuild 가 이름 충돌로 export 를 조용히 떨어뜨린다.
 *
 * export 를 추가할 때는 원본(`entry.ts` / `provider.tsx`)만 고치면 된다. 여기는 자동으로 따라온다.
 */

export * from './entry';
export * from './provider';
