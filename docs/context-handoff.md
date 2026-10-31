# SNOW Growth Signal Tracker Context Handoff

생성일: 2026-05-16 KST  
저장소: `https://github.com/marcellokim/snow-growth-signal-tracker`  
현재 브랜치: `main`  
현재 HEAD: `558367f` (`License portfolio tracker under MIT`)

이 문서는 다음 작업자나 새 Codex 세션이 프로젝트 맥락을 바로 이어받기 위한 단일 이관 문서다. 공개 저장소에 커밋될 수 있는 문서이므로 Google Sheet ID, Apps Script ID, OAuth callback URL, auth code, 로컬 credential 경로, 개인 계정 토큰은 의도적으로 포함하지 않는다.

## 1. 최종 목표

SNOW Growth Signal Tracker는 SNOW 계열 카메라 앱과 사진 편집 경쟁 앱의 주간 성장 신호를 Google Sheets에서 추적하는 TypeScript + Google Apps Script 기반 워크북 자동화 프로젝트다.

대상 앱:

- SNOW
- SODA
- Foodie
- EPIK
- B612
- BeautyPlus
- Meitu
- Remini

대상 시장:

- KR
- US
- JP

추적 항목:

- 핵심 기능과 AI 기능 메시지
- 유료 가격/구독 메시지
- App Store 키워드/앱 설명 변화
- 공개 TikTok/Instagram 검색 결과 패턴
- 수집 소스 상태, 실패 사유, 수동 확인 필요 여부
- 한 주 단위 `Weekly Summary`

성공 기준:

- 로컬에서 `npm ci && npm run verify`로 타입체크, 테스트, Apps Script 번들이 통과한다.
- Google Sheets 워크북에 필요한 탭이 자동 생성/검증된다.
- Google Sheet의 `Growth Tracker` 메뉴에서 드라이런/실행/트리거 설치가 가능하다.
- 실제 실행 결과가 `Weekly Summary`, `Growth Signals`, `Store Keywords`, `Sources & Runs` 등에 기록된다.
- 차단/부분 수집/저신뢰 소스가 실패로 묻히지 않고 manual check row로 남는다.
- 공개 GitHub 포트폴리오로 리뷰 가능한 README, QA 증거, 스크린샷, 라이선스가 준비되어 있다.

## 2. 저장소 현재 상태

핵심 파일:

```text
src/domain.ts       시트 이름, 스키마, row 타입, 주차 정규화
src/config.ts       추적 앱, 시장, 점수 가중치
src/connectors.ts   App Store, 공개 URL, 수동 큐 커넥터
src/scoring.ts      키워드 비교와 성장 신호 점수화
src/summary.ts      주간 요약 row 생성
src/runner.ts       주간 실행 오케스트레이션과 시트 row 교체
src/gas.ts          Apps Script 메뉴, 드라이런, 스케줄 실행, 트리거 진입점
src/sheets.ts       Apps Script 및 테스트용 시트 게이트웨이 어댑터
scripts/build-gas.mjs
tests/
docs/apps-script-setup.md
docs/qa-evidence.md
docs/assets/
README.md
LICENSE
NOTICE.md
```

패키지/런타임:

- Node.js 22 권장
- npm + `package-lock.json`
- TypeScript
- Google Apps Script V8
- clasp
- esbuild
- Vitest

NPM scripts:

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run --passWithNoTests
npm run build       # Apps Script bundle 생성
npm run verify      # typecheck + test + build
```

Apps Script manifest:

- timezone: `Asia/Seoul`
- runtime: `V8`
- Execution API access: `MYSELF`
- OAuth scopes:
  - `spreadsheets.currentonly`
  - `script.external_request`
  - `script.scriptapp`

## 3. 진행 타임라인

### 3.1 초기 산출물 단계

초기 요청은 다음 범위였다.

- `Google Sheets 1개 + 1페이지 인사이트 요약`
- SNOW/SODA/Foodie/EPIK 및 경쟁 앱의 기능, 광고, 가격, AI 콘텐츠를 주간 단위로 정리

초기 Google Drive/Sheets 쓰기 경로는 403 문제로 안정적이지 않았다. 그래서 먼저 로컬 XLSX와 Markdown 요약 fallback 산출물을 만들고 검증했다. 이 단계는 이후 실제 Google Apps Script 기반 tracker repo로 옮겨가기 위한 요구사항과 스키마 기준을 잡는 역할을 했다.

### 3.2 TypeScript + Apps Script 프로젝트화

프로젝트를 `snow-growth-signal-tracker` 저장소로 구성했다.

주요 설계:

- 도메인 스키마를 `src/domain.ts`에 고정
- 추적 앱/시장/점수 가중치를 `src/config.ts`에 고정
- 수집 커넥터를 `src/connectors.ts`에 분리
- 점수화와 요약 생성을 `src/scoring.ts`, `src/summary.ts`에 분리
- 실제 주간 실행을 `src/runner.ts`로 집중
- Apps Script 진입점을 `src/gas.ts`로 제공
- `scripts/build-gas.mjs`가 `src/gas.ts`를 IIFE로 번들하고 `build/Code.js`, `build/appsscript.json`을 생성

필수 시트:

- `Weekly Summary`
- `Growth Signals`
- `App Matrix`
- `Store Keywords`
- `Ad Messages`
- `Social Patterns`
- `Sources & Runs`
- `Config`

### 3.3 Apps Script 진입점과 live QA 보강

Apps Script에서 함수 탐색이 안정적으로 되도록 `scripts/build-gas.mjs`에서 top-level wrapper를 추가했다.

노출 함수:

- `onOpen`
- `runWeeklyTracker`
- `runWeeklyTrackerDryRun`
- `runWeeklyTrackerScheduled`
- `installWeeklyTrigger`

`src/gas.ts`도 동일 함수를 `globalThis.__snowGrowthSignalTracker`와 top-level에 연결한다.

트리거 정책:

- Sheet 메뉴 `Install Weekly Trigger`가 기존 `runWeeklyTracker` / `runWeeklyTrackerScheduled` 트리거를 정리한다.
- 이후 Monday 09:00 `runWeeklyTrackerScheduled` 트리거를 생성한다.
- scheduled handler는 UI alert 없이 `console.log` / `console.error` 경로를 사용한다.

### 3.4 Google 인증과 실제 Sheet 실행 QA

clasp 인증과 Apps Script API enable 이후, `clasp create --type sheets --title "SNOW Growth Signal Tracker" --rootDir build` 경로로 bound Google Sheet + Apps Script 프로젝트 생성에 성공했다.

검증된 배포 절차:

```bash
npm run build
npx clasp login
npx clasp create --type sheets --title "SNOW Growth Signal Tracker" --rootDir build
npx clasp push
```

이미 bound project가 있을 때:

```bash
npm run build
npx clasp status
npx clasp push
```

실제 QA 결과:

- Google Sheet `Growth Tracker` 메뉴가 렌더링됨
- `Run Weekly Tracker` 실행으로 `2026-W19` row가 생성됨
- `Weekly Summary`에 `Overview`, `Top Growth Signal`, `Top Changes`, `Manual Checks`가 생성됨
- `Store Keywords`에 SNOW/SODA/Foodie/EPIK/B612/BeautyPlus/Meitu 등 App Store row가 생성됨
- `Growth Signals`에 TikTok/Instagram 공개 페이지 partial/low-confidence signal row가 생성됨
- `Sources & Runs`에 App Store `ok`, TikTok/Instagram `partial` 또는 `blocked`가 기록됨
- `HTTP 429` 같은 public social source failure가 manual check row로 남음

중요한 caveat:

- `clasp run runWeeklyTrackerScheduled`는 OAuth 민감 scope / Apps Script Execution API 승인 문제로 실패할 수 있다.
- 이 프로젝트의 지원 live QA 경로는 `clasp run`이 아니라 Google Sheet 메뉴 실행과 spreadsheet readback이다.
- `clasp logs` 등 일부 CLI 경로는 별도 GCP project linkage가 필요할 수 있다.

### 3.5 GitHub 공개와 CI

저장소는 public GitHub repo로 공개되었다.

원격:

```text
https://github.com/marcellokim/snow-growth-signal-tracker.git
```

CI:

- `.github/workflows/ci.yml`
- push to `main` 및 pull request에서 실행
- Node.js 22
- `npm ci`
- `npm run verify`

GitHub Actions runtime은 최신 major action으로 갱신했다.

### 3.6 포트폴리오 polish

포트폴리오 제출용으로 다음을 정리했다.

- README 한국어화
- 로컬 실행 경로를 `npm ci && npm run verify`로 명확화
- Google Sheets 배포 절차 문서화
- `docs/apps-script-setup.md`에 Apps Script API enable, `clasp create`, QA checklist, trigger, CLI caveat 정리
- `docs/qa-evidence.md`에 비공개 Sheet QA 증거 정리
- `.env.example` 추가: 로컬 환경 변수 없음, clasp credential은 repo 밖에 저장
- 스크린샷 자산 추가:
  - `docs/assets/weekly-summary-preview.png`
  - `docs/assets/source-runs-preview.png`
  - SVG 원본도 함께 보관
- MIT `LICENSE` 추가
- `NOTICE.md` 추가: SNOW/SODA/Foodie/EPIK/B612/BeautyPlus/Meitu/Remini 및 플랫폼 상표권은 각 소유자에게 있음을 고지
- `package.json` / `package-lock.json` license metadata를 `MIT`로 설정

## 4. 커밋 히스토리 요약

최근 주요 커밋:

```text
558367f License portfolio tracker under MIT
23c5c7a Show live QA screenshots in README
4e98b90 Localize README for Korean review
247a1fe Make tracker reviewable after live Sheet QA
b388da5 Expose Apps Script entrypoints for live QA
25d5499 Use current GitHub Action runtimes
3090c23 Verify the tracker on GitHub pushes
674f8f6 Make the tracker repo easier to review
e025498 Reduce tracker duplication to keep weekly runs maintainable
eabf291 Explain the public tracker project
26ccc50 Make dry-run alerts precise
4cd2f9e Clarify Apps Script deployment binding
```

커밋 메시지는 Lore protocol을 따랐다. 주요 커밋에는 `Constraint`, `Rejected`, `Confidence`, `Scope-risk`, `Directive`, `Tested`, `Not-tested`, `Co-authored-by` trailer가 포함되어 있다.

## 5. 검증 기록

로컬 검증 명령:

```bash
npm run verify
```

검증 내용:

- `npm run typecheck`
- `npm run test`
- `npm run build`

가장 최근 확인된 결과:

- TypeScript 통과
- Vitest `6` test files / `49` tests 통과
- Apps Script build 통과
- `git diff --check` 통과
- secret pattern scan 통과
- PNG screenshot 해상도: `1600 x 920`

CI 검증:

- GitHub Actions가 `npm ci` + `npm run verify`를 실행한다.
- public repo의 `main` push와 PR에서 동일 경로가 검증된다.

Live Google Sheets QA:

- 2026-05-05 KST에 private bound Google Sheet에서 수행
- Sheet 메뉴 경로로 실행 성공
- private workbook은 공개 demo link로 제공하지 않음
- 민감 정보는 `README.md`, `docs/qa-evidence.md`, screenshot asset에서 제거됨

## 6. 보안/프라이버시 주의사항

절대 커밋하지 말 것:

- `.clasp.json`
- OAuth callback URL
- OAuth auth code
- Google Sheet ID
- Apps Script ID
- deployment ID
- Google credential/token
- 개인 계정 cookie
- 비공개 workbook URL
- `.env` 또는 `.env.*`

이미 `.gitignore`에 포함된 주요 항목:

```text
.omx/
node_modules/
build/
.clasp.json
.env
.env.*
!.env.example
npm-debug.log*
*.log
.DS_Store
```

중요 정책:

- TikTok/Instagram은 공개 비로그인 페이지만 확인한다.
- 개인 로그인 쿠키나 인증된 scraping session을 넣지 않는다.
- blocked/partial/low-confidence source는 실패로 숨기지 말고 manual check item으로 남긴다.
- same-title Google Sheet shortcut이 여러 개 보여도 title만 보고 중복/삭제 판단을 하지 않는다.

## 7. 현재 배포/운영 방식

권장 운영 절차:

1. 로컬에서 변경
2. `npm run verify`
3. `npm run build`
4. `npx clasp status`로 upload 대상이 `build/Code.js`, `build/appsscript.json`뿐인지 확인
5. `npx clasp push`
6. Google Sheet reload
7. `Growth Tracker -> Dry Run Weekly Tracker`
8. 권한 승인
9. `Growth Tracker -> Run Weekly Tracker`
10. 핵심 탭 readback:
    - `Weekly Summary`
    - `Growth Signals`
    - `Store Keywords`
    - `Sources & Runs`
11. 필요 시 `Growth Tracker -> Install Weekly Trigger`

초기 setup 문서:

- `docs/apps-script-setup.md`

QA 증거 문서:

- `docs/qa-evidence.md`

## 8. 다음 작업 후보

우선순위 높은 후보:

1. GitHub README 렌더링을 브라우저에서 최종 확인
2. public repo의 GitHub license detection 확인
3. fresh clone에서 `npm ci && npm run verify` 재확인
4. 별도 Google 계정 또는 깨끗한 clasp profile에서 신규 Sheet setup 재현 테스트
5. 실제 Monday trigger가 한 번 실행되는지 장기 확인

기능 개선 후보:

1. `Ad Messages` / `Social Patterns`에 더 풍부한 수동 입력/검토 workflow 추가
2. Google Play 또는 Meta Ad Library를 안정적인 public/manual source로 확장
3. `Weekly Summary`를 더 compact하게 만들고, top signal 근거 문장을 한국어 중심으로 다듬기
4. source run 통계를 시트 내 dashboard row 또는 chart로 요약
5. screenshot asset 재생성 스크립트 추가

하지 말아야 할 것:

- private Sheet를 공개 demo로 링크하지 않기
- public social source의 login-only 데이터를 자동 수집하려고 하지 않기
- cosmetic 목적만으로 Execution API access를 `ANYONE`으로 넓히지 않기
- `.clasp.json`이나 Google ID를 문서에 박지 않기

## 9. 빠른 이어받기 절차

새 작업자는 다음 순서로 시작하면 된다.

```bash
cd /Users/ydmac/Documents/snow-growth-signal-tracker
git status --short --branch
npm ci
npm run verify
```

문서부터 읽을 때:

1. `README.md`
2. `docs/apps-script-setup.md`
3. `docs/qa-evidence.md`
4. 이 문서 `docs/context-handoff.md`

코드 흐름을 볼 때:

1. `src/domain.ts`
2. `src/config.ts`
3. `src/runner.ts`
4. `src/gas.ts`
5. `scripts/build-gas.mjs`
6. `tests/gas.test.ts`
7. `tests/runner.test.ts`

## 10. 현재 판단

이 저장소는 인턴 포트폴리오 제출용으로 기본 완성도가 갖춰진 상태다.

강점:

- 실제 Google Sheets + Apps Script live QA까지 완료
- 실패/부분 수집 소스를 manual QA로 격상하는 설계가 명확함
- README, screenshot, QA evidence, CI, LICENSE, NOTICE가 모두 있음
- 로컬 검증 경로가 단순함

남은 리스크:

- private Google Sheet이므로 공개 demo link는 없음
- `clasp run` CLI 경로는 OAuth/Execution API 승인 문제로 primary path가 아님
- 장기 trigger 실행은 별도 시간이 지나야 검증 가능
- 외부 public source 구조 변경과 rate limit은 계속 발생할 수 있음

추천하는 다음 한 단계:

GitHub 웹에서 README 이미지와 license badge/detection이 정상 표시되는지 확인하고, 필요하면 README 상단에 짧은 “실제 Google Sheet QA 완료” 문장을 더 강하게 배치한다.
