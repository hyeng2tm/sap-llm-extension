# SAP LLM Extension

SAP LLM Extension adds an in-editor chat panel for code analysis and review using your company AI gateway.

## Features

- Chat panel with streaming responses
- Selection-based actions:
	- `SAP LLM: 코드 분석`
	- `SAP LLM: 버그 찾기`
	- `SAP LLM: 리팩토링 제안`
	- `SAP LLM: 성능 분석`
	- `SAP LLM: 보안 점검`
	- `SAP LLM: 테스트 케이스 생성`
- File attachment support from editor and explorer
- Chat history save/load under `.sap-llm/history`

## Configuration

Set these in VS Code Settings:

- `companyAi.apiBaseUrl`
- `companyAi.clientId`
- `companyAi.clientSecret`
- `companyAi.agentId`
- `companyAi.agentCode`
- `companyAi.userId`
- `companyAi.longResponseThresholdMs`
- `companyAi.historyRetentionDays`
- `companyAi.maxHistorySnapshots`

## Build

```bash
npm install
npm run compile
```

## Package

```bash
npx @vscode/vsce package
```
