# SAP LLM Extension

SAP LLM Extension은 사내 AI 게이트웨이와 연동해 VS Code 안에서 코드 분석, 리뷰, 첨부 기반 질의를 수행할 수 있는 확장입니다.

## 주요 기능

- SAP LLM Chat 패널에서 스트리밍 응답
- 코드 선택 기반 분석 액션
	- SAP LLM: 코드 분석
	- SAP LLM: 버그 찾기
	- SAP LLM: 리팩토링 제안
	- SAP LLM: 성능 분석
	- SAP LLM: 보안 점검
	- SAP LLM: 테스트 케이스 생성
- 선택 코드 구간에 CodeLens 액션 표시
- 파일 첨부
	- 채팅 입력창 파일 첨부
	- Explorer 우클릭으로 채팅에 첨부
- 채팅 히스토리 자동 저장/불러오기
- 채팅 내보내기
	- 전체 대화 Markdown 저장
	- 개별 응답 Markdown/Text 저장
- 응답 생성 취소

## 설치

### VSIX 설치

1. Extensions 메뉴 열기
2. 우상단 메뉴에서 Install from VSIX... 선택
3. VSIX 파일 선택 후 설치

CLI 설치:

```bash
code --install-extension sap-llm-extension-<version>.vsix
```

## 필수 설정

VS Code Settings에서 companyAi 항목을 설정해야 동작합니다.

- companyAi.apiBaseUrl
	- 기본값: https://devx-gw.shinsegae-inc.com/api
- companyAi.clientId
- companyAi.clientSecret
- companyAi.agentId
- companyAi.agentCode
- companyAi.userId

## 선택 설정

- companyAi.longResponseThresholdMs
	- 기본값: 10000
	- 응답이 지연될 때 UI 상태 표시 기준
- companyAi.historyRetentionDays
	- 기본값: 14
	- 0이면 기간 기반 삭제 비활성화
- companyAi.maxHistorySnapshots
	- 기본값: 100
	- 보관 스냅샷 최대 수

## 사용 방법

### 채팅 패널 열기

- Activity Bar의 SAP LLM 아이콘 클릭
- 또는 Command Palette에서 SAP LLM: 채팅 패널 열기 실행

### 코드 분석 액션 실행

1. 에디터에서 코드 선택
2. 우클릭 컨텍스트 메뉴에서 액션 실행
3. 채팅 패널이 열리며 선택 코드 기반 질의 자동 전송

선택된 코드 구간에는 CodeLens 버튼도 함께 제공됩니다.

### 파일 첨부

- 채팅 입력창 파일 첨부 버튼 사용
- Explorer에서 파일 선택 후 우클릭, SAP LLM: 채팅에 첨부

제한:

- 파일당 2MB까지 허용
- 폴더 첨부 불가

### 히스토리

- 저장 경로: .sap-llm/history
- 최신 히스토리 자동 로드
- 패널 상단 히스토리 버튼으로 스냅샷 선택 로드

### 내보내기

- 전체 대화 Markdown 내보내기
- 응답 단건 Markdown/Text 내보내기

### 응답 취소

- 응답 생성 중 취소 버튼으로 현재 스트리밍 중단

## 개발

### 빌드

```bash
npm install
npm run compile
```

### Watch

```bash
npm run watch
```

### VSIX 패키징

```bash
npx @vscode/vsce package
```

VSIX 버전은 확장 루트 package.json의 version 값을 따릅니다.

## 트러블슈팅

### 인증 실패

- clientId, clientSecret, apiBaseUrl 값을 재확인

### API 응답 에러

- agentId, agentCode, userId 확인
- 사내 네트워크 경로 및 권한 확인

### 첨부 실패

- 2MB 초과 파일 여부 확인
- 폴더 선택 여부 확인

### 히스토리 문제

- 워크스페이스가 열려 있는지 확인
- .sap-llm/history 폴더 권한 확인
