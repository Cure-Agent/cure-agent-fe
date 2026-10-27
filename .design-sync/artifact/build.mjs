#!/usr/bin/env node
/**
 * design-sync 빌드 산출물(`ds-bundle/`)을 Claude Design System 아티팩트의 파일 표(`project/**`)로 옮긴다.
 *
 * 단독 Claude Design(claude.ai/design)은 2026-12-14에 닫힌다. 그 자리를 잇는 것이 claude.ai 아티팩트의
 * "Design System" 타입인데, Claude Code 2.1.311의 `/design-sync`는 여전히 claude.ai/design에만 올린다.
 * 그래서 빌드(`.ds-sync/resync.mjs` → `ds-bundle/`)는 그대로 쓰고, 그 산출물을 타입의 파일 표로 옮기는
 * 단계만 이 레포가 갖는다. 옮기는 규칙은 타입의 `artifact-type/reference/format.md` 「Aliases」가
 * design-sync 레이아웃에 대해 적어 둔 대응과 같다 — 두 단계 `components/<group>/<Name>/` → `components/<Name>/`,
 * 카드에 `_preview/<Name>.js`를 인라인하고 프레임이 미리 싣는 태그는 걷는다.
 *
 *   node .design-sync/artifact/build.mjs [--note "<한 줄>"] [--remote-index <파일>] [--check]
 *
 *   --remote-index  아티팩트에서 읽어 온 `project/design-system.json`. 주면 이 스크립트가 쓰지 않는 키
 *                   (createdOnFiles·sections·blobs·docs …)를 원격 그대로 이어받는다.
 *   --check         만든 preview.html을 프레임처럼(tokens.css·bundle.css·라이브러리·bundle.js를 먼저)
 *                   헤드리스 Chrome으로 그려 오류·빈 카드·높이를 잰다. playwright는 `.ds-sync/node_modules`의 것.
 *
 * 산출물은 `.design-sync/.cache/artifact/`(gitignore) 아래 `project/**`와, Artifact 게시 호출에 그대로 넘길
 * `publish.json`(url·root·file_path·files)이다. 손으로 쓰는 입력은 같은 폴더의 notes.json(요약·카드 높이·
 * 토큰 메모·글자 스타일)·target.json(아티팩트 주소·업로드한 에셋)·cover.html·logos.md 다.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const BUNDLE = join(ROOT, 'ds-bundle');
const OUT = join(ROOT, '.design-sync', '.cache', 'artifact');
const PROJECT = join(OUT, 'project');

// 테마 변수 중 일부러 옮기지 않는 것 — 타입에 motion 계열이 없고, default-* 는 다른 변수의 별칭이다.
const SKIPPED_THEME_VARS = /^(ease-|animate-|default-)/;
const DEFAULT_CARD_HEIGHT = 400;

const args = parseArgs(process.argv.slice(2));
const target = readJson(join(HERE, 'target.json'));
const notes = readJson(join(HERE, 'notes.json'));
const warnings = [];
const written = new Map(); // project 기준 경로 → 바이트

function parseArgs(argv) {
  const out = { note: null, remoteIndex: null, check: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--note') out.note = argv[++i];
    else if (argv[i] === '--remote-index') out.remoteIndex = argv[++i];
    else if (argv[i] === '--check') out.check = true;
    else fail(`모르는 인자: ${argv[i]}`);
  }
  return out;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
}

function git(...gitArgs) {
  return execFileSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function emit(rel, content) {
  const abs = join(PROJECT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  written.set(rel, Buffer.byteLength(content));
}

// 소비자는 bundle.js·라이브러리를 <script> 안에 인라인으로 싣는다(format.md recipe:use-components).
// 이 두 문자열이 있으면 그 자리에서 요소가 끝나거나 주석이 열린다.
function assertInlineSafe(label, text) {
  if (/<\/script|<!--/i.test(text)) fail(`${label}: </script 또는 <!-- 가 들어 있다 — 인라인으로 실리면 문서가 깨진다`);
}

function clampHeight(px) {
  return Math.min(4000, Math.max(40, px));
}

function replaceOnce(text, find, replacement, label) {
  const at = text.indexOf(find);
  if (at < 0 || text.indexOf(find, at + 1) >= 0) {
    fail(`${label}: 「${find.trim()}」을 정확히 한 번 찾지 못했다 — design-sync 카드 형식이 바뀌었는지 볼 것`);
  }
  return text.slice(0, at) + replacement + text.slice(at + find.length);
}

// ── 번들 ────────────────────────────────────────────────────────────────────────────────

if (!existsSync(join(BUNDLE, '_ds_bundle.js'))) {
  fail('ds-bundle/_ds_bundle.js 가 없다 — 먼저 재동기화 빌드(.ds-sync/resync.mjs)를 돌릴 것');
}
rmSync(OUT, { recursive: true, force: true });

const bundleJs = read(join(BUNDLE, '_ds_bundle.js'));
const headerEnd = bundleJs.indexOf('\n');
const header = /^\/\* @ds-bundle: (\{.*\}) \*\/$/.exec(bundleJs.slice(0, headerEnd));
if (!header) fail('_ds_bundle.js 첫 줄에 @ds-bundle 머리말이 없다');
const { namespace, components } = JSON.parse(header[1]);
const names = components.map((c) => c.name);
assertInlineSafe('_ds_bundle.js', bundleJs);
// 머리말의 sourcePath 는 옛 두 단계 레이아웃의 .jsx 스텁을 가리켜 여기서는 없는 경로다 — 이름만 남긴다.
const bundleHeader = { format: 4, namespace, components: names.map((name) => ({ name })) };
emit('components/bundle.js', `/* @ds-bundle: ${JSON.stringify(bundleHeader)} */${bundleJs.slice(headerEnd)}`);

const stylesEntry = read(join(BUNDLE, 'styles.css')).trim();
if (stylesEntry !== '@import "./_ds_bundle.css";') {
  warnings.push(`styles.css 가 _ds_bundle.css 하나만 가져오지 않는다 — 나머지는 옮기지 않았다: ${stylesEntry.slice(0, 120)}`);
}
const bundleCss = read(join(BUNDLE, '_ds_bundle.css'));
if (/<\/style/i.test(bundleCss)) fail('_ds_bundle.css: </style 이 들어 있다 — 인라인으로 실리면 문서가 깨진다');
emit('components/bundle.css', bundleCss);

// 타입은 react/react-dom 18 만 jsDelivr 에서 대신 실어 준다. 이 번들은 React 19 로 빌드됐으므로
// 컨버터가 묶은 것(react.js 하나에 React·ReactDOM 이 함께 들고, react-dom.js 는 빈 자리표시)을 파일로 싣는다.
const reactVersion = createRequire(join(ROOT, 'package.json'))('react/package.json').version;
const libraries = [];
for (const [name, global] of [['react', 'React'], ['react-dom', 'ReactDOM']]) {
  const lib = read(join(BUNDLE, '_vendor', `${name}.js`));
  assertInlineSafe(`_vendor/${name}.js`, lib);
  emit(`components/lib/${name}.js`, lib);
  libraries.push({ name, version: reactVersion, global, file: `components/lib/${name}.js` });
}
if (!read(join(BUNDLE, '_vendor', 'react.js')).includes(`"${reactVersion}"`)) {
  warnings.push(`_vendor/react.js 에서 React ${reactVersion} 을 찾지 못했다 — 번들과 앱의 React 가 어긋났을 수 있다`);
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────────────────

const groupOf = new Map();
for (const group of readdirSync(join(BUNDLE, 'components'))) {
  const groupDir = join(BUNDLE, 'components', group);
  if (!statSync(groupDir).isDirectory()) continue;
  for (const name of readdirSync(groupDir)) groupOf.set(name, group);
}
for (const name of groupOf.keys()) {
  if (!names.includes(name)) warnings.push(`${name}: components/ 에는 있는데 번들 머리말에 없다 — 옮기지 않았다`);
}

const dtsParts = [];
for (const name of names) {
  const group = groupOf.get(name);
  if (!group) fail(`${name}: 번들 머리말에는 있는데 ds-bundle/components/*/${name}/ 가 없다`);
  const dir = join(BUNDLE, 'components', group, name);
  emit(`components/${name}/preview.html`, previewHtml(name, group, read(join(dir, `${name}.html`))));
  emit(`components/${name}/README.md`, componentReadme(name, read(join(dir, `${name}.prompt.md`))));
  const dts = read(join(dir, `${name}.d.ts`));
  emit(`components/${name}/${name}.d.ts`, dts);
  dtsParts.push(dts.replace(/^import \* as React from 'react';\n/m, '').trim());
}
emit('components/index.d.ts', `import * as React from 'react';\n\n${dtsParts.join('\n\n')}\n`);

// 프레임이 tokens.css·bundle.css·라이브러리·bundle.js 를 미리 싣고 <html data-theme> 을 세운다
// (format.md 「The preview.html contract」). 그래서 그 태그들을 걷고, 스토리 모듈을 하네스와 한 <script> 로 합친다.
// 스토리 모듈 첫 줄의 "use strict" 가 하네스까지 덮는데, 하네스는 모든 변수를 var 로 선언해 엄격 모드에서도 돈다.
function previewHtml(name, group, html) {
  const stories = read(join(BUNDLE, '_preview', `${name}.js`));
  assertInlineSafe(`_preview/${name}.js`, stories);
  const lineEnd = html.indexOf('\n');
  const marker = /^<!-- @dsCard group="([^"]*)"(?: viewport="(\d+)x(\d+)")? -->$/.exec(html.slice(0, lineEnd));
  if (!marker) fail(`${name}.html 첫 줄이 예상한 @dsCard 마커가 아니다`);
  if (marker[1] !== group) warnings.push(`${name}: 마커의 group(${marker[1]})과 폴더(${group})가 다르다 — 폴더를 따른다`);

  let body = html.slice(lineEnd + 1);
  for (const tag of [
    '  <link rel="stylesheet" href="../../../styles.css">\n',
    '  <link rel="stylesheet" href="../../../_ds_bundle.css">\n',
    '  <script src="../../../_vendor/react.js"></script>\n',
    '  <script src="../../../_vendor/react-dom.js"></script>\n',
    '  <script src="../../../_ds_bundle.js"></script>\n',
  ]) {
    body = replaceOnce(body, tag, '', `${name}.html`);
  }
  body = replaceOnce(body, `  <script src="../../../_preview/${name}.js"></script>\n  <script>\n`, `  <script>\n${stories.trimEnd()}\n;\n`, `${name}.html`);
  body = replaceOnce(body, '<meta charset="utf-8">', `<meta charset="utf-8"><title>${name} — preview</title>`, `${name}.html`);
  if (body.includes('../../../')) fail(`${name}.html: 옮기지 못한 ../../../ 참조가 남았다`);

  // 높이는 행의 최소 높이다(넘치면 자란다). --check 가 잰 내용 높이로 다시 쓰고, notes.json cards 는
  // 잴 수 없는 것(화면을 꽉 채우는 AppShell 처럼 뷰포트를 따라가는 카드)만 고정한다.
  const width = marker[2] ? Number(marker[2]) : null;
  const height = notes.cards[name]?.height ?? (marker[3] ? Number(marker[3]) : DEFAULT_CARD_HEIGHT);
  if (!args.check && !notes.cards[name]) warnings.push(`${name}: --check 없이 돌려 카드 높이를 재지 않았다 — ${height}px 로 둔다`);
  const attrs = [`group="${group}"`, `height=${clampHeight(height)}`];
  if (width) attrs.push(`width=${width}`);
  const out = `<!-- @dsCard ${attrs.join(' ')} -->\n${body}`;
  if (Buffer.byteLength(out) > 256 * 1024) fail(`${name}/preview.html 이 256 KB 를 넘는다`);
  return out;
}

// 컨버터의 첫 줄(「<Name> from cure-agent-fe. Use via … _ds_bundle.js …」)은 옛 레이아웃의 경로를 가리키고,
// 첫 문장이 카드 목록의 요약이 되므로 notes.json 의 요약으로 바꾼다. 나머지(Props·Examples)는 그대로다.
function componentReadme(name, prompt) {
  const lineEnd = prompt.indexOf('\n');
  if (!prompt.slice(0, lineEnd).startsWith(`${name} from `)) fail(`${name}.prompt.md 첫 줄이 예상한 상투문이 아니다`);
  const summary = notes.summaries[name];
  if (!summary) fail(`${name}: notes.json summaries 에 요약이 없다 — 첫 문장이 카드 목록의 요약이 된다`);
  const usage = `\`window.${namespace}.${name}\` 로 쓴다(\`components/bundle.js\`). 트리를 \`<DsPreviewProvider>\` 로 감싸야 렌더된다 — 이유는 시스템 README 1절.`;
  return `${summary}\n\n${usage}\n${prompt.slice(lineEnd + 1)}`;
}

// ── README ──────────────────────────────────────────────────────────────────────────────

// 페이지가 「Consuming this system」을 덧붙이는 것은 사람이 저장할 때뿐이고, 코드 동기화 시스템은
// 페이지가 저장하지 않는다(from-code.md). 그래서 싣는 법을 여기서 덧붙인다.
const conventions = read(join(ROOT, '.design-sync', 'conventions.md')).trimEnd();
emit(
  'README.md',
  `${conventions}

## 번들 싣기

컴포넌트 ${names.length}개는 \`components/bundle.js\` 하나에 들어 있고 \`window.${namespace}\` 로 실린다. 번들은
React ${reactVersion} 으로 빌드·검증됐다 — 다른 React 와 섞지 말 것. \`components/lib/react.js\` 가 React 와 ReactDOM 을
함께 싣고, \`components/lib/react-dom.js\` 는 빈 자리표시다. 싣는 순서:

1. 스타일: \`tokens.css\`, 그다음 \`components/bundle.css\`
2. 스크립트: \`components/lib/react.js\` → \`components/lib/react-dom.js\` → \`components/bundle.js\`

호스트 페이지의 React 루트가 아니라 전용 자식 노드에 마운트한다:

\`\`\`jsx
const { DsPreviewProvider, AppShell, CLINICIAN } = window.${namespace};
ReactDOM.createRoot(document.getElementById('ds-root')).render(
  <DsPreviewProvider>
    <AppShell me={CLINICIAN}>{/* 페이지 본문 */}</AppShell>
  </DsPreviewProvider>,
);
\`\`\`
`,
);

// ── 토큰 ────────────────────────────────────────────────────────────────────────────────

// 커스텀 @theme 이 없어 토큰의 원천은 Tailwind 가 쓰인 클래스만큼 내보낸 테마 변수다. 이름은 변수 그대로
// (-- 만 뗀다) 둔다 — tokens.css 가 같은 이름을 레이어 밖에서 다시 선언하므로, 값이 같으면 카드가 바뀌지 않는다.
const theme = new Map();
{
  const layer = /@layer theme\s*\{\s*:root,\s*:host\s*\{([\s\S]*?)\}\s*\}/.exec(bundleCss);
  if (!layer) fail('_ds_bundle.css 에서 @layer theme { :root, :host { … } } 를 찾지 못했다');
  for (const [, name, value] of layer[1].matchAll(/--([A-Za-z0-9_.-]+)\s*:\s*([^;]+);/g)) {
    theme.set(name, value.replace(/\s+/g, ' ').trim());
  }
}
const placed = new Set();
const take = (name) => {
  if (!theme.has(name)) fail(`테마 변수 --${name} 이 번들 CSS 에 없다 — notes.json 이 낡았는지 볼 것`);
  placed.add(name);
  return theme.get(name);
};
const usageOf = (name) => {
  const usage = notes.tokens[name];
  if (!usage) warnings.push(`토큰 ${name}: notes.json tokens 에 쓰임 메모가 없다`);
  return usage ?? '';
};
const family = (prefix) =>
  [...theme.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name, value: take(name), usage: usageOf(name) }));

const colorTokens = family('color-').map((token) => {
  const value = token.value.startsWith('#') ? token.value.toLowerCase() : token.value;
  if (!/^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\([^()]*\))$/.test(value)) {
    fail(`토큰 ${token.name}: 타입이 읽지 못하는 색 값이다 — ${value}`);
  }
  return { ...token, value };
});

const families = {};
for (const key of ['sans', 'mono']) {
  const stack = take(`font-${key}`);
  if (stack.length > 200 || /[;{}<>\\()]/.test(stack)) fail(`--font-${key}: 타입이 읽지 못하는 글꼴 스택이다`);
  families[key] = stack;
}
const ratio = (calc) => {
  const m = /^calc\(([\d.]+) \/ ([\d.]+)\)$/.exec(calc);
  if (!m) fail(`줄 높이 ${calc} 를 비율로 풀지 못했다`);
  return Math.round((Number(m[1]) / Number(m[2])) * 10000) / 10000;
};
const styles = notes.typeStyles.map((style) => {
  if (new RegExp(`\\.${style.name}(?![\\w-])`).test(bundleCss)) {
    fail(`글자 스타일 ${style.name}: 번들 CSS 에 같은 클래스가 있다 — tokens.css 의 .${style.name} 이 레이어 밖에서 그것을 덮는다`);
  }
  const fontSize = take(`text-${style.size}`);
  const lineHeight = style.leading ? Number(take(`leading-${style.leading}`)) : ratio(take(`text-${style.size}--line-height`));
  const fontWeight = style.weight === 'normal' ? 400 : Number(take(`font-weight-${style.weight}`));
  return { name: style.name, fontSize, lineHeight, fontWeight, usage: style.usage };
});
for (const name of theme.keys()) {
  if (/^text-[a-z0-9]+$/.test(name) && !placed.has(name)) warnings.push(`--${name}: 이 크기를 쓰는 글자 스타일이 notes.json 에 없다`);
}

const spacingBase = take('spacing');
const [, baseAmount, baseUnit] = /^([\d.]+)(rem|px)$/.exec(spacingBase) ?? fail(`--spacing ${spacingBase} 를 풀지 못했다`);
const spacing = [
  { name: 'spacing', value: spacingBase, usage: usageOf('spacing') },
  ...notes.spacingSteps.map(({ step, usage }) => ({
    name: `spacing-${step}`,
    value: `${Math.round(Number(step) * Number(baseAmount) * 10000) / 10000}${baseUnit}`,
    usage,
  })),
];

const tokens = {
  name: target.title,
  version: 1,
  color: { themes: [{ id: 'light', name: 'Light' }], tokens: colorTokens },
  type: { fonts: [], families, groups: [{ name: 'Text', family: 'sans', styles }] },
  spacing: { tokens: spacing },
  radius: { tokens: family('radius-') },
  container: { note: 'Tailwind max-w-* 의 폭.', tokens: family('container-') },
  leading: { note: '글자 스타일의 기본 줄 높이를 바꿀 때만.', tokens: family('leading-') },
};
for (const name of theme.keys()) {
  if (!placed.has(name) && !SKIPPED_THEME_VARS.test(name) && !/^text-[a-z0-9]+(--line-height)?$/.test(name) && !name.startsWith('font-weight-')) {
    warnings.push(`--${name}: 자리를 찾지 못한 테마 변수 — tokens.json 에 옮기지 않았다`);
  }
}
for (const name of Object.keys(notes.tokens)) {
  if (!placed.has(name) && !name.startsWith('spacing')) warnings.push(`notes.json tokens.${name}: 번들에 없는 토큰의 메모다`);
}

const sha = git('rev-parse', '--short', 'HEAD');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const repo = /github\.com[:/](.+?)(?:\.git)?$/.exec(git('remote', 'get-url', 'origin'))?.[1] ?? 'unknown';
// 재동기화는 배포 커밋보다 먼저 돌므로(automation/ship.md) 보통 HEAD 에 없는 변경이 함께 실린다 — 알리기만 한다.
const uncommitted = git('status', '--porcelain', '--', 'src', '.design-sync/ds-preview', '.design-sync/previews', '.design-sync/config.json', '.design-sync/conventions.md', '.design-sync/tailwind-entry.css');
if (uncommitted) {
  warnings.push(`meta.ref 는 HEAD(${branch}@${sha})다 — 커밋하지 않은 빌드 입력 ${uncommitted.split('\n').length}개가 함께 실렸다`);
}
const componentSrcMap = readJson(join(ROOT, '.design-sync', 'config.json')).componentSrcMap;
tokens.meta = {
  source: 'github',
  repo,
  ref: `${branch}@${sha}`,
  paths: { tokens: ['src/app/globals.css'], docs: ['.design-sync/conventions.md'] },
  components: Object.fromEntries(names.map((name) => [name, componentSrcMap[name]])),
  synced: new Date().toISOString().slice(0, 10),
};
emit('tokens.json', `${JSON.stringify(tokens, null, 2)}\n`);

// 코드 동기화 시스템은 페이지가 tokens.css 를 쓰지 않으므로 동기화가 쓴다. 배치는 format.md
// 「tokens.css as compiled」를, 첫 줄은 craft.md 「One source」의 표지를 따른다.
{
  const cssName = (name) => name.replace(/\./g, '\\.');
  const lines = [`/* ${target.title} — generated from tokens.json */`];
  lines.push(`:root, [data-theme="${tokens.color.themes[0].id}"] {`);
  for (const token of tokens.color.tokens) lines.push(`  --${cssName(token.name)}: ${token.value};`);
  lines.push('}', ':root {');
  for (const key of ['spacing', 'radius', 'container', 'leading']) {
    for (const token of tokens[key].tokens) lines.push(`  --${cssName(token.name)}: ${token.value};`);
  }
  for (const [key, stack] of Object.entries(families)) lines.push(`  --font-${key}: ${stack};`);
  lines.push('}');
  for (const group of tokens.type.groups) {
    for (const style of group.styles) {
      lines.push(
        `.${cssName(style.name)} { font-family: var(--font-${group.family}); font-size: ${style.fontSize}; line-height: ${style.lineHeight}; font-weight: ${style.fontWeight}; }`,
      );
    }
  }
  emit('tokens.css', `${lines.join('\n')}\n`);
}

// ── 표지·에셋·앵커 ───────────────────────────────────────────────────────────────────────

const cover = read(join(HERE, 'cover.html'));
if (!/^<!-- @dsCard height=\d+ -->\n/.test(cover)) fail('cover.html 첫 줄이 @dsCard 마커가 아니다');
emit('components/Cover/preview.html', cover);

// 그림 에셋은 파일이 아니라 업로드다 — 색인이 blob 으로 가리킨다. 올린 뒤 원본이 바뀌면 다시 올려야 한다.
// 업로드는 SVG 를 정리해 저장한다(빈 요소를 여닫는 태그로 풀고 끝 줄바꿈을 뗀다). 그래서 size 는 저장본의
// 크기이고, 바뀜 판정은 원본의 해시(sourceSha256)로 한다.
const assetGroups = {};
for (const [group, spec] of Object.entries(target.assets)) {
  const files = {};
  for (const [file, record] of Object.entries(spec.files)) {
    if (!record.blob) fail(`${group}/${file}: target.json 에 blob 이 없다 — 먼저 에셋으로 올릴 것`);
    const digest = createHash('sha256').update(readFileSync(join(ROOT, record.source))).digest('hex');
    if (digest !== record.sourceSha256) {
      warnings.push(`${record.source} 가 올린 뒤 바뀌었다 — 다시 올리고 target.json 의 blob·size·sourceSha256 을 갱신할 것`);
    }
    files[file] = { name: file, blob: record.blob, size: record.size, type: record.type };
  }
  assetGroups[group] = { name: group, tile: spec.tile, order: Object.keys(files), files };
  emit(`assets/${group}/README.md`, read(join(HERE, spec.readme)));
}

// 다음 재동기화가 diff 기준으로 받아 올 앵커. 로컬 캐시만 믿지 않으려고 아티팩트에도 둔다(NOTES 「로컬 앵커」).
emit('sync/ds-sync.json', read(join(BUNDLE, '_ds_sync.json')));

// ── 색인 ────────────────────────────────────────────────────────────────────────────────

const lastChange = {
  by: git('config', 'user.name') || 'Claude',
  at: new Date().toISOString(),
  via: `Claude Code · ${repo}@${sha}`,
  note: args.note ?? `재동기화 — 컴포넌트 ${names.length}개`,
};
const owned = { title: target.title, namespace, libraries, groups: Object.keys(assetGroups), assetGroups, editing: 'code', lastChange };
let index;
if (args.remoteIndex) {
  const remote = readJson(args.remoteIndex);
  if (!remote.createdOnFiles && !remote.convertedFrom) fail('--remote-index 에 createdOnFiles·convertedFrom 표지가 없다 — 색인이 아니다');
  if (remote.title !== target.title) warnings.push(`원격 색인의 title(${remote.title})이 target.json 과 다르다 — target.json 을 따른다`);
  index = { ...remote, ...owned };
} else {
  if (!target.createdOnFiles.at) fail('target.json 의 createdOnFiles.at 이 비었다 — 아티팩트를 만든 시각을 적을 것');
  index = { v: 3, layout: 'files', createdOnFiles: target.createdOnFiles, ...owned, sections: {}, blobs: {}, docs: { readme: 'project/README.md', sections: [] } };
}
emit('design-system.json', `${JSON.stringify(index, null, 2)}\n`);

// ── 게시 호출 ────────────────────────────────────────────────────────────────────────────

// 게시 도구는 .ts 를 서빙 형식으로 모른다 — 타입 선언은 형식을 text/plain 으로 밝혀 싣는다.
const files = {};
for (const rel of [...written.keys()].sort()) {
  if (rel === 'design-system.json') continue;
  files[`project/${rel}`] = rel.endsWith('.ts') ? { from: `project/${rel}`, contentType: 'text/plain' } : `project/${rel}`;
}
const totalBytes = [...written.values()].reduce((sum, bytes) => sum + bytes, 0);
if (written.size > 255) fail(`파일 ${written.size}개 — 한 번에 255개까지 올라간다. 색인을 마지막 호출에 두고 나눠 올릴 것`);
if (totalBytes > 15 * 1024 * 1024) fail(`합계 ${(totalBytes / 1048576).toFixed(1)} MB — 한 호출은 16 MiB 까지다`);
writeFileSync(
  join(OUT, 'publish.json'),
  `${JSON.stringify({ url: target.url, root: OUT, file_path: join(PROJECT, 'design-system.json'), files }, null, 2)}\n`,
);

console.log(`✓ ${OUT}/project — 파일 ${written.size}개, ${(totalBytes / 1048576).toFixed(2)} MB`);
console.log(`  컴포넌트 ${names.length} · 색 ${colorTokens.length} · 글자 스타일 ${styles.length} · 간격 ${spacing.length} · 에셋 그룹 ${Object.keys(assetGroups).length}`);
console.log(`  게시 인자: ${join(OUT, 'publish.json')}`);
for (const message of warnings) console.log(`⚠ ${message}`);

if (args.check) await check();

// ── 렌더 확인 ────────────────────────────────────────────────────────────────────────────

async function check() {
  const playwright = join(ROOT, '.ds-sync', 'node_modules', 'playwright', 'index.mjs');
  if (!existsSync(playwright)) fail('.ds-sync/node_modules 에 playwright 가 없다 — NOTES 「재동기화 한 줄 요약」의 설치 줄을 볼 것');
  const { chromium } = await import(pathToFileURL(playwright).href);
  const browser = await chromium.launch({
    executablePath: process.env.DS_CHROMIUM_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const preload = [
    `<link rel="stylesheet" href="${pathToFileURL(join(PROJECT, 'tokens.css')).href}">`,
    `<link rel="stylesheet" href="${pathToFileURL(join(PROJECT, 'components', 'bundle.css')).href}">`,
    ...[...libraries.map((lib) => lib.file), 'components/bundle.js'].map((file) => `<script src="${pathToFileURL(join(PROJECT, file)).href}"></script>`),
  ].join('');
  const checkDir = join(OUT, 'check');
  mkdirSync(checkDir, { recursive: true });
  let failed = 0;
  for (const name of [...names, 'Cover']) {
    const rel = `components/${name}/preview.html`;
    const html = read(join(PROJECT, rel));
    const width = Number(/ width=(\d+)/.exec(html.slice(0, html.indexOf('\n')))?.[1] ?? (name === 'Cover' ? 960 : 1200));
    const doc = replaceOnce(html.replace('<html>', `<html data-theme="${tokens.color.themes[0].id}">`), '<head>', `<head>${preload}`, rel);
    const file = join(checkDir, `${name}.html`);
    writeFileSync(file, doc, 'utf8');
    const page = await browser.newPage({ viewport: { width, height: notes.cards[name]?.height ?? 800 } });
    const errors = [];
    const consoleErrors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    // documentElement.scrollHeight 는 뷰포트 높이 아래로 내려가지 않는다 — 내용 높이는 body 상자로 잰다.
    const state = await page.evaluate(() => ({
      height: Math.ceil(document.body.getBoundingClientRect().height),
      textLength: document.body.innerText.trim().length,
      warning: document.body.innerText.includes('⚠'),
    }));
    await page.close();
    const bad = errors.length > 0 || state.textLength === 0 || state.warning;
    if (bad) failed++;
    if (name !== 'Cover' && !notes.cards[name]) {
      emit(rel, html.replace(/^(<!-- @dsCard [^\n]*?)height=\d+/, `$1height=${clampHeight(state.height)}`));
    }
    console.log(
      `${bad ? '✗' : '✓'} ${name.padEnd(22)} 높이 ${String(state.height).padStart(5)}px · 글자 ${state.textLength}` +
        (errors.length ? ` · 오류 ${errors[0]}` : '') +
        (consoleErrors.length ? ` · console.error ${consoleErrors.length}건: ${consoleErrors[0].slice(0, 140)}` : ''),
    );
  }
  await browser.close();
  if (failed) fail(`렌더 확인 실패 ${failed}건`);
}
