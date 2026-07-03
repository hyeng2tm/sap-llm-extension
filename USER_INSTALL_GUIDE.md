# SAP LLM Extension 사용자 가이드

## 1. 문서 목적

이 문서는 SAP LLM Extension의 실제 기능과 사용 방법을 사용자 관점에서 정리한 가이드입니다.

## 2. 주요 기능

- 채팅 패널 기반 AI 질의/응답
- 코드 선택 기반 빠른 분석 액션
  - SAP LLM: 코드 분석
  - SAP LLM: 버그 찾기
  - SAP LLM: 리팩토링 제안
  - SAP LLM: 성능 분석
  - SAP LLM: 보안 점검
  - SAP LLM: 테스트 케이스 생성
- 에디터/탐색기 파일 첨부
- 채팅 히스토리 자동 저장/불러오기
- 채팅 내용 Markdown/Text 내보내기
- 응답 스트리밍 및 응답 취소

## 3. 설치

### 방법 A: VS Code UI 설치

1. VS Code를 엽니다.
2. Extensions 화면으로 이동합니다.
3. 우상단 메뉴에서 Install from VSIX...를 선택합니다.
4. VSIX 파일을 선택합니다.
5. 설치 후 Reload가 나오면 실행합니다.

### 방법 B: CLI 설치

```bash
code --install-extension sap-llm-extension-<version>.vsix
```

## 4. 필수 설정

Settings에서 companyAi를 검색해 아래 값을 입력하세요.

- companyAi.apiBaseUrl
  - 기본값: https://devx-gw.shinsegae-inc.com/api
- companyAi.clientId
- companyAi.clientSecret
- companyAi.agentId
- companyAi.agentCode
- companyAi.userId

입력하지 않으면 인증 토큰 발급이 실패해 채팅을 사용할 수 없습니다.

## 5. 선택 설정

- companyAi.longResponseThresholdMs
  - 기본값: 10000
  - 지정 시간보다 응답이 길어지면 UI에서 지연 상태를 표시
- companyAi.historyRetentionDays
  - 기본값: 14
  - 0이면 기간 기준 삭제 비활성화
- companyAi.maxHistorySnapshots
  - 기본값: 100
  - 보관 스냅샷 최대 개수

## 6. 채팅 패널 열기

아래 중 한 가지로 열 수 있습니다.

1. Activity Bar의 SAP LLM 아이콘 클릭
2. Command Palette에서 SAP LLM: 채팅 패널 열기 실행

## 7. 코드 분석 기능 사용법

### 에디터 선택 후 컨텍스트 메뉴

1. 코드 일부를 선택합니다.
2. 우클릭 메뉴에서 원하는 액션을 실행합니다.
3. 채팅 패널이 열리며 선택 코드와 함께 분석 요청이 전송됩니다.

### CodeLens 버튼으로 실행

코드를 선택하면 선택 구간에 CodeLens가 나타납니다.

- SAP LLM: 코드 분석
- 버그 찾기
- 리팩토링 제안
- 성능 분석
- 보안 점검
- 테스트 케이스 생성

## 8. 파일 첨부

### 탐색기에서 첨부

1. Explorer에서 파일 1개 이상 선택
2. 우클릭
3. SAP LLM: 채팅에 첨부 실행

### 제한 사항

- 파일당 최대 2MB
- 폴더는 첨부 불가
- 대용량/불가 항목은 자동 제외 후 알림

## 9. 채팅 히스토리

- 저장 위치: 워크스페이스 루트 하위 .sap-llm/history
- 웹뷰 초기화 시 최신 히스토리 자동 로드
- 패널에서 과거 스냅샷 선택 로드 가능
- 설정값에 따라 오래된 파일/초과 파일 자동 정리

## 10. 내보내기

채팅 패널에서 대화를 파일로 저장할 수 있습니다.

- Markdown(.md) 저장
- Text(.txt) 저장

## 11. 응답 취소

- 응답 생성 중 취소 버튼을 누르면 현재 스트리밍 요청을 중단합니다.
- 취소 메시지가 채팅에 표시됩니다.

## 12. 자주 발생하는 문제

### 인증 실패

- companyAi.clientId / companyAi.clientSecret 확인
- companyAi.apiBaseUrl 오탈자 확인

### API 응답 에러

- agentId, agentCode, userId 값 확인
- 사내 네트워크/게이트웨이 접근 권한 확인

### 첨부 실패

- 파일 크기 2MB 초과 여부 확인
- 폴더를 선택하지 않았는지 확인

### 히스토리가 보이지 않음

- 워크스페이스를 열었는지 확인
- .sap-llm/history 폴더 생성/권한 상태 확인

## 13. 업데이트 및 제거

### 업데이트

- 새 VSIX를 기존과 동일하게 설치하면 업데이트됩니다.

### 제거

1. Extensions에서 SAP LLM Extension 선택
2. Uninstall 실행
3. 필요 시 VS Code Reload

## 14. 문의 시 전달하면 좋은 정보

- VS Code 버전
- 설치한 VSIX 파일명
- 입력한 주요 설정 항목(민감정보는 마스킹)
- 오류 메시지 원문
- 재현 순서
