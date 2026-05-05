# SNOW Growth Signal Tracker

SNOW Growth Signal Tracker는 SNOW 계열 카메라 앱과 주요 사진 편집 경쟁 앱의 주간 성장 신호를 Google Sheets에서 추적하는 TypeScript + Google Apps Script 기반 워크북 자동화 프로젝트입니다.

SNOW, SODA, Foodie, EPIK, B612, BeautyPlus, Meitu, Remini를 KR, US, JP 시장 기준으로 추적합니다. 워크북은 App Store 포지셔닝, AI 관련 기능 신호, 공개 TikTok/Instagram 검색 체크, 소스 상태, 수동 확인 필요 항목, 1페이지 주간 요약을 기록합니다.

```bash
npm ci
npm run verify
```

`npm run verify`는 TypeScript 검사, Vitest 테스트, Apps Script 번들 빌드를 한 번에 실행합니다.

## 주요 기능

- 필요한 Google Sheets 워크북 탭을 생성하고 스키마를 검증합니다.
- App Store Search와 공개 TikTok/Instagram 검색 페이지를 대상으로 주간 수집 플랜을 실행합니다.
- 변화 강도, 성장 관련성, 신뢰도, 반복성을 기준으로 성장 신호를 점수화합니다.
- 과거 row는 보존하고 현재 주차에 생성된 row만 교체합니다.
- `Weekly Summary`에 간결한 주간 요약을 쓰고, 신호/키워드/앱 매트릭스/소스 실행 기록을 별도 탭에 남깁니다.
- 차단, 부분 수집, 저신뢰 공개 소스는 숨기지 않고 수동 확인 항목으로 기록합니다.
- Apps Script 메뉴에서 드라이런, 실주간 실행, 월요일 트리거 설치를 제공합니다.

## 기술 스택

- TypeScript
- Google Apps Script V8
- SpreadsheetApp, UrlFetchApp, ScriptApp
- bound Apps Script 프로젝트 배포용 clasp
- 번들링용 esbuild
- 로컬 테스트용 Vitest

## 저장소 구조

```text
src/domain.ts       시트 이름, 스키마, row 타입, 주차 정규화
src/config.ts       추적 앱, 시장, 점수 가중치
src/connectors.ts   App Store, 공개 URL, 수동 큐 커넥터
src/scoring.ts      키워드 비교와 성장 신호 점수화
src/summary.ts      주간 요약 row 생성
src/runner.ts       주간 실행 오케스트레이션과 시트 row 교체
src/gas.ts          Apps Script 메뉴, 드라이런, 스케줄 실행, 트리거 진입점
src/sheets.ts       Apps Script 및 테스트용 시트 게이트웨이 어댑터
tests/              스키마, 커넥터, 러너, 점수화, 요약, GAS 진입점 테스트
scripts/build-gas.mjs
docs/apps-script-setup.md
```

## 로컬 실행

필수 조건:

- CI와 동일하게 Node.js 22 사용을 권장합니다.
- 패키지 설치는 커밋된 `package-lock.json` 기준으로 npm을 사용합니다.
- Google 계정은 실제 Apps Script 배포를 할 때만 필요합니다.

설치 및 검증:

```bash
npm ci
npm run verify
```

자주 쓰는 명령:

```bash
npm run typecheck   # TypeScript 검사만 실행
npm test            # Vitest만 실행
npm run build       # build/Code.js와 build/appsscript.json 생성
npm run verify      # typecheck, test, build 전체 실행
```

## 설정과 인증

로컬 테스트나 빌드에는 `.env` 파일이 필요하지 않습니다.

실제 배포 인증은 `clasp`가 처리합니다.

- `.clasp.json`은 이 저장소를 특정 Apps Script 프로젝트에 연결하는 로컬 상태이며 git에 커밋하지 않습니다.
- `npx clasp login`은 Google 인증 정보를 이 저장소 밖에 저장합니다.
- Apps Script OAuth scope는 [appsscript.json](appsscript.json)에 선언되어 있습니다.
- Apps Script Execution API 접근은 배포자 본인으로 제한되어 있으며, 실제 실행은 Google Sheet 메뉴 경로를 기준으로 합니다.
- Google 인증 정보, 로컬 워크북 바인딩, 복사한 쿠키, 비공개 소셜 계정 접근 정보는 커밋하지 마세요.

현재 로컬 환경 변수 계약은 [.env.example](.env.example)에 안전한 형태로 정리되어 있습니다.

## Google Sheets 배포

권장 배포 대상은 Google Sheets 워크북에 연결된 bound Google Apps Script 프로젝트입니다.

전체 설정 가이드는 다음 문서를 보세요.

- [docs/apps-script-setup.md](docs/apps-script-setup.md)

신규 QA 워크북을 만드는 짧은 경로:

```bash
npm run build
npx clasp login
npx clasp create --type sheets --title "SNOW Growth Signal Tracker" --rootDir build
npx clasp push
```

이미 bound Apps Script 프로젝트가 있다면 `npx clasp create` 대신 `npx clasp clone <SCRIPT_ID> --rootDir build`를 사용합니다.

푸쉬 후 Google Sheet를 새로고침하고 `Growth Tracker` 메뉴를 사용합니다.

- `Dry Run Weekly Tracker`
- `Run Weekly Tracker`
- `Install Weekly Trigger`

Google 인증, 메뉴 표시, `clasp push`, 트리거 실행은 대상 Google 계정에서 직접 확인해야 합니다. 로컬 검증만으로는 외부 계정 단계가 정상이라고 증명할 수 없습니다. 민감 정보를 제외한 현재 QA 증거는 [docs/qa-evidence.md](docs/qa-evidence.md)에 정리되어 있습니다.

`clasp run`은 이 프로젝트의 기본 QA 경로가 아닙니다. 로컬 Google OAuth 클라이언트가 Apps Script Execution API의 민감 scope 승인을 받지 못하면 실패할 수 있습니다. 지원되는 실제 실행 경로는 Google Sheet 메뉴입니다.

## 소스 수집 정책

TikTok과 Instagram 체크는 공개 비로그인 페이지 기준으로만 수행합니다. 개인 로그인 쿠키, 인증된 스크래핑 세션, 비공개 계정 접근은 사용하지 않습니다.

차단, rate limit, 저신뢰 소스는 전체 주간 실행을 실패시키지 않습니다. 대신 소스 상태 row와 수동 확인 항목으로 기록합니다.

## 현재 검증 상태

- 로컬 검증: `npm run verify`.
- CI 검증: GitHub Actions가 `main` 푸쉬 및 pull request에서 `npm ci`와 `npm run verify`를 실행합니다.
- 실제 워크북 QA: 비공개 bound Google Sheet에서 `Growth Tracker` 메뉴로 검증했습니다. 실행 결과 `2026-W19` 기준 `Weekly Summary`, `Growth Signals`, `Store Keywords`, `Sources & Runs`에 row가 기록되었습니다.

실제 QA 워크북은 계정에 귀속된 Google Sheet이므로 공개 데모 링크로 제공하지 않습니다.

## 스크린샷

아직 스크린샷은 포함되어 있지 않습니다. 주요 UI는 Apps Script 배포 후 대상 Google Sheets 워크북입니다.

## 라이선스

아직 오픈소스 라이선스가 선언되어 있지 않습니다. 프로젝트 소유자 외 재사용을 권장하려면 먼저 라이선스를 추가해야 합니다.
