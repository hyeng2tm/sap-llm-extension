# SAP LLM Extension 사용자 설치 매뉴얼

## 1. 목적

이 문서는 개인 사용자 기준으로 SAP LLM Extension을 VSIX 파일로 설치하고, 최초 실행까지 완료하는 방법을 안내합니다.

## 2. 준비물

- Visual Studio Code 설치
- 배포받은 VSIX 파일
  - 예: sap-llm-extension-0.0.1.vsix
- 사내 AI 접속 정보
  - companyAi.apiBaseUrl
  - companyAi.clientId
  - companyAi.clientSecret
  - companyAi.agentId
  - companyAi.agentCode
  - companyAi.userId

## 3. 설치 방법

### 방법 A: VS Code UI로 설치

1. VS Code를 엽니다.
2. 왼쪽 사이드바에서 Extensions 메뉴를 엽니다.
3. 우상단 더보기 메뉴를 누릅니다.
4. Install from VSIX... 를 선택합니다.
5. 전달받은 VSIX 파일을 선택합니다.
6. 설치 완료 후 필요하면 Reload 버튼을 눌러 반영합니다.

### 방법 B: 명령줄로 설치

1. 터미널을 엽니다.
2. VSIX 파일이 있는 폴더로 이동합니다.
3. 아래 명령을 실행합니다.

code --install-extension sap-llm-extension-0.0.1.vsix

4. 설치 완료 후 VS Code를 다시 로드합니다.

## 4. 최초 설정

1. VS Code Settings를 엽니다.
2. 검색창에 companyAi 를 입력합니다.
3. 아래 항목을 입력합니다.
   - companyAi.apiBaseUrl
   - companyAi.clientId
   - companyAi.clientSecret
   - companyAi.agentId
   - companyAi.agentCode
   - companyAi.userId
4. 선택 설정
   - companyAi.longResponseThresholdMs
   - companyAi.historyRetentionDays
   - companyAi.maxHistorySnapshots

## 5. 동작 확인

1. Command Palette를 엽니다.
2. SAP LLM: 채팅 패널 열기 를 실행합니다.
3. 왼쪽 Activity Bar에 SAP LLM 아이콘이 보이는지 확인합니다.
4. 채팅창에서 질문을 입력하고 Send를 눌러 응답을 확인합니다.
5. 코드 파일에서 일부를 선택하면 분석 관련 메뉴를 사용할 수 있습니다.

## 6. 화면 배치 추천

- SAP LLM 뷰는 최초 설치 후 자동으로 열리지 않을 수 있습니다.
- 필요할 때 Command Palette에서 SAP LLM: 채팅 패널 열기 를 실행하면 됩니다.
- Explorer와 채팅창을 동시에 보고 싶으면 SAP LLM 아이콘 우클릭 > Move To 로 이동합니다.
- Move To 메뉴에서 Secondary Side Bar를 선택하면 Explorer는 왼쪽, SAP LLM은 오른쪽에 배치할 수 있습니다.
- Secondary Side Bar가 보이지 않으면 View: Toggle Secondary Side Bar 를 먼저 실행합니다.

## 7. 파일 첨부 사용법

- 채팅창 Attach 버튼으로 여러 파일 첨부 가능
- 탐색기에서 파일 여러 개 선택 후 우클릭 > SAP LLM: 채팅에 첨부 가능
- 파일당 최대 크기: 2MB

## 8. 업데이트 방법

새 버전 VSIX를 받으면 동일한 방식으로 다시 설치하면 업데이트됩니다.

- UI: Install from VSIX...로 새 파일 선택
- CLI: code --install-extension <새 VSIX 파일명>

## 9. 제거 방법

1. Extensions 메뉴에서 SAP LLM Extension을 찾습니다.
2. 톱니바퀴 메뉴에서 Uninstall을 선택합니다.
3. 필요 시 VS Code를 다시 로드합니다.

## 10. 자주 발생하는 문제

### 인증 오류

- clientId, clientSecret 오입력 여부 확인
- apiBaseUrl 오입력 여부 확인

### 파일 업로드 실패

- 파일 크기 2MB 초과 여부 확인
- 네트워크/사내 API 접근 가능 여부 확인

### 히스토리 관련

- 히스토리는 워크스페이스 내부 .sap-llm/history 경로에 저장됩니다.
- 문제가 있으면 채팅창을 닫았다가 다시 열어 상태를 새로고침합니다.

### Explorer와 채팅창이 같은 위치에 보이는 경우

- SAP LLM 아이콘 우클릭 후 Move To 메뉴를 확인합니다.
- Secondary Side Bar로 이동하면 Explorer와 분리해서 사용할 수 있습니다.
- 메뉴가 보이지 않으면 VS Code를 한 번 Reload한 뒤 다시 확인합니다.

## 11. 문의 시 전달 정보

문제 발생 시 아래 정보를 함께 전달하면 분석이 빠릅니다.

- 사용 중인 VS Code 버전
- 설치한 VSIX 파일명
- 오류 메시지 전체
- 재현 순서
