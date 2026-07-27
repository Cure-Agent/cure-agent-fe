/**
 * design-sync 번들 런타임에는 Next 의 빌드타임 치환이 없다.
 * src/shared/config/env.ts 의 `process.env.NEXT_PUBLIC_API_BASE_URL` 이 그대로 남아
 * 브라우저에서 ReferenceError(process is not defined)를 내고 번들 초기화 전체가 죽는다.
 *
 * 앱이 해당 env 미설정 시 쓰는 기본값(same-origin '')과 동일한 상태를 만들어 준다.
 * cfg.extraEntries 의 **첫 항목**이어야 한다 — .bundle-entry.mjs 가 extraEntries 를
 * 메인 엔트리보다 먼저 re-export 하므로, 이 모듈 본문이 앱 모듈보다 먼저 실행된다.
 * 이 파일은 어떤 것도 import 하지 않는다 (import 가 있으면 그 본문이 먼저 실행된다).
 */
// globalThis 를 그대로 교차(&)하면 @types/node 의 `process: NodeJS.Process` 와 겹쳐
// env 가 NODE_ENV 필수인 ProcessEnv 로 좁혀진다 — 빈 객체를 넣을 수 없게 된다.
// 여기서 필요한 건 존재 여부와 env 슬롯뿐이라 그 부분만 떼어 본다.
const g = globalThis as { process?: { env: Record<string, string | undefined> } };

if (typeof g.process === 'undefined') {
  g.process = { env: {} };
} else if (typeof g.process.env === 'undefined') {
  g.process.env = {};
}

export const __dsProcessShim = true;
