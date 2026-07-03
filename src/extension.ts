import * as vscode from 'vscode';
import axios from 'axios';
import { Buffer } from 'buffer';

type SelectionActionTarget = {
    range?: vscode.Range;
};

type CodeContext = {
    text: string;
    sourceLabel: string;
};

type WebviewAttachment = {
    name: string;
    mimeType?: string;
    size?: number;
    contentBase64: string;
};

type SelectionAnalysisContext = {
    text: string;
    sourceLabel: string;
};

type PersistedChatMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    kind?: 'error' | 'canceled';
    statusText?: string;
};

type HistorySnapshotEntry = {
    uri: vscode.Uri;
    name: string;
    mtime: number;
    snapshotAtMs?: number;
};

type HistorySnapshotSummary = {
    messageCount: number;
    snapshotAt?: string;
    lastMessagePreview?: string;
};

export function activate(context: vscode.ExtensionContext) {
    const provider = new CompanyAgentProvider(context.extensionUri);
    const codeLensProvider = new AnalyzeSelectionCodeLensProvider();

    context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer('sapLlmChatPanel', {
            async deserializeWebviewPanel(panel: vscode.WebviewPanel) {
                provider.restoreWebviewPanel(panel);
            }
        })
    );

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            [
                { scheme: 'file' },
                { scheme: 'untitled' }
            ],
            codeLensProvider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('sap-llm.analyzeCode', async (target?: SelectionActionTarget) => {
            await provider.runSelectionAction(
                '선택한 코드를 분석해줘. 핵심 로직, 잠재 이슈, 개선 포인트를 설명해줘.',
                '선택한 코드 분석해줘',
                target
            );
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('sap-llm.findBugs', async (target?: SelectionActionTarget) => {
            await provider.runSelectionAction(
                '선택한 코드에서 잠재 버그, 예외 케이스, 논리 오류 가능성을 찾아줘. 심각도 순으로 설명해줘.',
                '선택한 코드의 버그를 찾아줘',
                target
            );
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('sap-llm.suggestRefactor', async (target?: SelectionActionTarget) => {
            await provider.runSelectionAction(
                '선택한 코드의 리팩토링 포인트를 찾아줘. 구조 개선, 가독성 개선, 중복 제거 방안을 우선순위로 설명해줘.',
                '선택한 코드의 리팩토링 포인트를 제안해줘',
                target
            );
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('sap-llm.reviewPerformance', async (target?: SelectionActionTarget) => {
            await provider.runSelectionAction(
                '선택한 코드의 성능 관점 이슈를 분석해줘. 병목 가능성, 불필요한 연산, 개선 방안을 설명해줘.',
                '선택한 코드의 성능을 분석해줘',
                target
            );
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('sap-llm.reviewSecurity', async (target?: SelectionActionTarget) => {
            await provider.runSelectionAction(
                '선택한 코드의 보안 이슈를 점검해줘. 입력 검증, 인증/인가, 민감정보 노출, 인젝션 가능성을 중심으로 설명해줘.',
                '선택한 코드의 보안 이슈를 점검해줘',
                target
            );
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('sap-llm.generateTests', async (target?: SelectionActionTarget) => {
            await provider.runSelectionAction(
                '선택한 코드를 기준으로 중요한 테스트 케이스를 생성해줘. 정상 흐름, 경계값, 예외 케이스를 구분해서 제안해줘.',
                '선택한 코드의 테스트 케이스를 생성해줘',
                target
            );
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('sap-llm.openChatPanel', async () => {
            await provider.openChatPanel();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('sap-llm.attachExplorerFile', async (uri: vscode.Uri) => {
            await provider.attachExplorerFile(uri);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(() => codeLensProvider.refresh()),
        vscode.window.onDidChangeActiveTextEditor(() => codeLensProvider.refresh())
    );

    setTimeout(() => {
        void provider.openChatPanelIfMissing();
    }, 1500);
}

class AnalyzeSelectionCodeLensProvider implements vscode.CodeLensProvider {
    private readonly onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

    public refresh(): void {
        this.onDidChangeCodeLensesEmitter.fire();
    }

    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
            return [];
        }

        if (editor.selection.isEmpty) {
            return [];
        }

        const selectionRange = editor.selection;
        const target = { range: selectionRange };

        return [
            new vscode.CodeLens(selectionRange, {
                title: 'SAP LLM: 코드 분석',
                command: 'sap-llm.analyzeCode',
                arguments: [target]
            }),
            new vscode.CodeLens(selectionRange, {
                title: '버그 찾기',
                command: 'sap-llm.findBugs',
                arguments: [target]
            }),
            new vscode.CodeLens(selectionRange, {
                title: '리팩토링 제안',
                command: 'sap-llm.suggestRefactor',
                arguments: [target]
            }),
            new vscode.CodeLens(selectionRange, {
                title: '성능 분석',
                command: 'sap-llm.reviewPerformance',
                arguments: [target]
            }),
            new vscode.CodeLens(selectionRange, {
                title: '보안 점검',
                command: 'sap-llm.reviewSecurity',
                arguments: [target]
            }),
            new vscode.CodeLens(selectionRange, {
                title: '테스트 케이스 생성',
                command: 'sap-llm.generateTests',
                arguments: [target]
            })
        ];
    }
}

class CompanyAgentProvider {
    private static readonly MAX_CONTEXT_BYTES = 48 * 1024;
    private static readonly MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
    private static readonly MAX_CHAT_HISTORY_MESSAGES = 200;
    private static readonly HISTORY_DIR = '.sap-llm/history';
    private static readonly MAX_HISTORY_SNAPSHOTS = 100;
    private static readonly DEFAULT_HISTORY_RETENTION_DAYS = 14;
    private static readonly TEXT_UPLOAD_EXTENSIONS = new Set([
        'abap',
        'txt',
        'md',
        'js',
        'ts',
        'tsx',
        'jsx',
        'json',
        'xml',
        'sql',
        'yaml',
        'yml',
        'csv'
    ]);

    private _authToken: string | null = null;
    private conversationId: string | null = null;
    private currentFileId: string | null = null;
    private historySessionId: string | null = null;
    private activeRequestAbortController: AbortController | null = null;
    private activeResponseId: string | null = null;
    private webviewPanel: vscode.WebviewPanel | null = null;
    private webviewReady: boolean = false;
    private webviewReadyResolver: (() => void) | null = null;
    private webviewReadyPromise: Promise<void> | null = null;
    
    constructor(
        private readonly _extensionUri: vscode.Uri
    ) {}

    private sanitizeChatHistoryMessages(messages: unknown): PersistedChatMessage[] {
        if (!Array.isArray(messages)) {
            return [];
        }

        return messages
            .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
            .map((entry) => {
                const role: PersistedChatMessage['role'] = entry.role === 'user' || entry.role === 'assistant' || entry.role === 'system'
                    ? entry.role
                    : 'system';
                const kind: PersistedChatMessage['kind'] = entry.kind === 'error' || entry.kind === 'canceled'
                    ? entry.kind
                    : undefined;
                return {
                    id: typeof entry.id === 'string' && entry.id.trim()
                        ? entry.id
                        : `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    role,
                    content: typeof entry.content === 'string' ? entry.content : '',
                    kind,
                    statusText: typeof entry.statusText === 'string' ? entry.statusText : undefined
                };
            })
            .slice(-CompanyAgentProvider.MAX_CHAT_HISTORY_MESSAGES);
    }

    private getHistoryDirectoryUri(): vscode.Uri | null {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot) {
            return null;
        }

        return vscode.Uri.joinPath(workspaceRoot, CompanyAgentProvider.HISTORY_DIR);
    }

    private ensureHistorySessionId(): string {
        if (!this.historySessionId) {
            this.historySessionId = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        }

        return this.historySessionId;
    }

    private async createSnapshotHistoryFileUri(historyDir: vscode.Uri): Promise<vscode.Uri> {
        return vscode.Uri.joinPath(historyDir, `chat-${this.ensureHistorySessionId()}.json`);
    }

    private async deleteHistorySnapshotGroup(historyDir: vscode.Uri, fileName: string): Promise<void> {
        try {
            const groupKey = this.getSnapshotHistoryGroupKey(fileName);
            const entries = await vscode.workspace.fs.readDirectory(historyDir);
            const duplicates = entries
                .filter(([name, type]) => type === vscode.FileType.File && this.getSnapshotHistoryGroupKey(name) === groupKey)
                .map(([name]) => vscode.Uri.joinPath(historyDir, name));

            await Promise.all(duplicates.map((uri) => vscode.workspace.fs.delete(uri)));
        } catch {
            // Best effort cleanup only.
        }
    }

    private async getLatestHistoryFileUri(): Promise<vscode.Uri | null> {
        const historyDir = this.getHistoryDirectoryUri();
        if (!historyDir) {
            return null;
        }

        try {
            const snapshots = await this.getHistorySnapshotEntries(historyDir);
            if (snapshots.length === 0) {
                return null;
            }

            return snapshots[0].uri;
        } catch {
            return null;
        }
    }

    private async getHistorySnapshotEntries(historyDir: vscode.Uri): Promise<HistorySnapshotEntry[]> {
        const entries = await vscode.workspace.fs.readDirectory(historyDir);
        const candidates = entries
            .filter(([name, type]) => type === vscode.FileType.File && /^chat-(?:session-[a-z0-9-]+|\d{4}-\d{2}-\d{2}(?:-\d{2}-\d{2}(?:-\d+)?)?)\.json$/i.test(name));

        const withMtime = await Promise.all(candidates.map(async ([name]) => {
            const uri = vscode.Uri.joinPath(historyDir, name);
            const stat = await vscode.workspace.fs.stat(uri);
            return {
                uri,
                name,
                mtime: stat.mtime,
                snapshotAtMs: await this.readSnapshotAtMs(uri)
            };
        }));

        withMtime.sort((a, b) => {
            const aTime = a.snapshotAtMs ?? a.mtime;
            const bTime = b.snapshotAtMs ?? b.mtime;
            return bTime - aTime;
        });
        return withMtime;
    }

    private getSnapshotHistoryGroupKey(fileName: string): string {
        const sessionMatch = fileName.match(/^(chat-session-[a-z0-9-]+\.json)$/i);
        if (sessionMatch) {
            return sessionMatch[1].toLowerCase();
        }

        const match = fileName.match(/^(chat-\d{4}-\d{2}-\d{2}-\d{2}-\d{2})(?:-\d+)?\.json$/);
        if (!match) {
            return fileName;
        }

        return `${match[1]}.json`;
    }

    private getLatestHistorySnapshotsByGroup(entries: HistorySnapshotEntry[]): HistorySnapshotEntry[] {
        const latestByGroup = new Map<string, HistorySnapshotEntry>();

        for (const entry of entries) {
            const groupKey = this.getSnapshotHistoryGroupKey(entry.name);
            if (!latestByGroup.has(groupKey)) {
                latestByGroup.set(groupKey, entry);
            }
        }

        return Array.from(latestByGroup.values());
    }

    private async readSnapshotAtMs(historyFile: vscode.Uri): Promise<number | undefined> {
        try {
            const raw = await vscode.workspace.fs.readFile(historyFile);
            const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as unknown;
            if (typeof parsed !== 'object' || parsed === null) {
                return undefined;
            }

            const asRecord = parsed as Record<string, unknown>;
            const snapshotAt = typeof asRecord.snapshotAt === 'string'
                ? asRecord.snapshotAt
                : (typeof asRecord.updatedAt === 'string' ? asRecord.updatedAt : undefined);
            if (!snapshotAt) {
                return undefined;
            }

            const ts = Date.parse(snapshotAt);
            return Number.isNaN(ts) ? undefined : ts;
        } catch {
            return undefined;
        }
    }

    private async loadChatHistoryFromFile(historyFile: vscode.Uri): Promise<PersistedChatMessage[]> {
        try {
            const raw = await vscode.workspace.fs.readFile(historyFile);
            const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as unknown;
            if (Array.isArray(parsed)) {
                return this.sanitizeChatHistoryMessages(parsed);
            }

            if (typeof parsed === 'object' && parsed !== null) {
                const asRecord = parsed as Record<string, unknown>;
                return this.sanitizeChatHistoryMessages(asRecord.messages);
            }
        } catch {
            return [];
        }

        return [];
    }

    private getLastMessagePreview(messages: PersistedChatMessage[]): string | undefined {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const content = messages[index]?.content?.replace(/\s+/g, ' ').trim();
            if (!content) {
                continue;
            }

            return content.length > 80 ? `${content.slice(0, 77)}...` : content;
        }

        return undefined;
    }

    private async readHistorySnapshotSummary(historyFile: vscode.Uri): Promise<HistorySnapshotSummary> {
        try {
            const raw = await vscode.workspace.fs.readFile(historyFile);
            const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as unknown;

            if (Array.isArray(parsed)) {
                const messages = this.sanitizeChatHistoryMessages(parsed);
                return {
                    messageCount: messages.length,
                    lastMessagePreview: this.getLastMessagePreview(messages)
                };
            }

            if (typeof parsed === 'object' && parsed !== null) {
                const asRecord = parsed as Record<string, unknown>;
                const messages = this.sanitizeChatHistoryMessages(asRecord.messages);
                const messageCount = typeof asRecord.messageCount === 'number'
                    ? Math.max(0, Math.floor(asRecord.messageCount))
                    : messages.length;
                const snapshotAt = typeof asRecord.snapshotAt === 'string'
                    ? asRecord.snapshotAt
                    : (typeof asRecord.updatedAt === 'string' ? asRecord.updatedAt : undefined);
                return {
                    messageCount,
                    snapshotAt,
                    lastMessagePreview: this.getLastMessagePreview(messages)
                };
            }
        } catch {
            // ignore malformed snapshot and fall back to defaults
        }

        return { messageCount: 0 };
    }

    private async showHistorySnapshotPickerAndLoad(webview: vscode.Webview): Promise<void> {
        const historyDir = this.getHistoryDirectoryUri();
        if (!historyDir) {
            webview.postMessage({ type: 'history-load-error', message: '워크스페이스가 열려 있지 않아 히스토리를 불러올 수 없습니다.' });
            return;
        }

        let snapshots: HistorySnapshotEntry[] = [];
        try {
            snapshots = await this.getHistorySnapshotEntries(historyDir);
        } catch {
            snapshots = [];
        }

        if (snapshots.length === 0) {
            webview.postMessage({ type: 'history-load-error', message: '불러올 히스토리 스냅샷이 없습니다.' });
            return;
        }

        const latestSnapshots = this.getLatestHistorySnapshotsByGroup(snapshots);

        const quickPickItems = await Promise.all(latestSnapshots.map(async (entry) => {
            const summary = await this.readHistorySnapshotSummary(entry.uri);
            const displayTime = summary.snapshotAt
                ? new Date(summary.snapshotAt).toLocaleString()
                : new Date(entry.snapshotAtMs ?? entry.mtime).toLocaleString();

            return {
                label: `${displayTime}`,
                description: `메시지 ${summary.messageCount}개`,
                detail: summary.lastMessagePreview
                    ? `${summary.lastMessagePreview} · ${entry.name}`
                    : entry.name,
                entry
            };
        }));

        const picked = await vscode.window.showQuickPick(quickPickItems, {
            title: '불러올 채팅 히스토리 선택',
            placeHolder: '스냅샷 파일을 선택하세요'
        });

        if (!picked) {
            return;
        }

        const messages = await this.loadChatHistoryFromFile(picked.entry.uri);
        webview.postMessage({
            type: 'history-loaded',
            messages,
            sourceName: picked.entry.name
        });
    }

    private async pruneOldHistorySnapshots(historyDir: vscode.Uri): Promise<void> {
        try {
            const entries = await vscode.workspace.fs.readDirectory(historyDir);
            const snapshotUris = entries
                .filter(([name, type]) => type === vscode.FileType.File && /^chat-(?:session-[a-z0-9-]+|\d{4}-\d{2}-\d{2}(?:-\d{2}-\d{2}(?:-\d+)?)?)\.json$/i.test(name))
                .map(([name]) => vscode.Uri.joinPath(historyDir, name));

            if (snapshotUris.length === 0) {
                return;
            }

            const { maxHistorySnapshots, historyRetentionDays } = this.getAgentConfig();
            const safeMaxSnapshots = Math.max(1, Math.floor(maxHistorySnapshots || CompanyAgentProvider.MAX_HISTORY_SNAPSHOTS));
            const safeRetentionDays = Math.max(0, Math.floor(historyRetentionDays));

            const withMtime = await Promise.all(snapshotUris.map(async (uri) => {
                const stat = await vscode.workspace.fs.stat(uri);
                return { uri, mtime: stat.mtime };
            }));

            if (safeRetentionDays > 0) {
                const cutoff = Date.now() - (safeRetentionDays * 24 * 60 * 60 * 1000);
                const expired = withMtime.filter((entry) => entry.mtime < cutoff);
                await Promise.all(expired.map(({ uri }) => vscode.workspace.fs.delete(uri)));
            }

            const entriesAfterRetention = await Promise.all(snapshotUris.map(async (uri) => {
                try {
                    const stat = await vscode.workspace.fs.stat(uri);
                    return { uri, mtime: stat.mtime };
                } catch {
                    return null;
                }
            }));

            const existingEntries = entriesAfterRetention
                .filter((entry): entry is { uri: vscode.Uri; mtime: number } => entry !== null);

            if (existingEntries.length <= safeMaxSnapshots) {
                return;
            }

            existingEntries.sort((a, b) => b.mtime - a.mtime);
            const stale = existingEntries.slice(safeMaxSnapshots);

            await Promise.all(stale.map(({ uri }) => vscode.workspace.fs.delete(uri)));
        } catch {
            // Best effort cleanup only.
        }
    }

    private async loadChatHistoryFromWorkspace(): Promise<PersistedChatMessage[]> {
        const latestFile = await this.getLatestHistoryFileUri();
        if (!latestFile) {
            return [];
        }

        try {
            const raw = await vscode.workspace.fs.readFile(latestFile);
            const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as unknown;
            if (Array.isArray(parsed)) {
                return this.sanitizeChatHistoryMessages(parsed);
            }

            if (typeof parsed === 'object' && parsed !== null) {
                const asRecord = parsed as Record<string, unknown>;
                return this.sanitizeChatHistoryMessages(asRecord.messages);
            }
        } catch {
            return [];
        }

        return [];
    }

    private async saveChatHistoryToWorkspace(messages: unknown): Promise<void> {
        const sanitized = this.sanitizeChatHistoryMessages(messages);
        const historyDir = this.getHistoryDirectoryUri();
        if (!historyDir) {
            return;
        }

        const targetFile = await this.createSnapshotHistoryFileUri(historyDir);
        const targetFileName = targetFile.path.split('/').pop() || `chat-${this.ensureHistorySessionId()}.json`;
        const payload = {
            date: new Date().toISOString().slice(0, 10),
            snapshotAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            historySessionId: this.ensureHistorySessionId(),
            messageCount: sanitized.length,
            messages: sanitized
        };

        await vscode.workspace.fs.createDirectory(historyDir);
        await this.deleteHistorySnapshotGroup(historyDir, targetFileName);
        await vscode.workspace.fs.writeFile(
            targetFile,
            new TextEncoder().encode(JSON.stringify(payload, null, 2))
        );
        await this.pruneOldHistorySnapshots(historyDir);
    }

    public restoreWebviewPanel(panel: vscode.WebviewPanel): void {
        this.webviewPanel = panel;
        this.ensureHistorySessionId();
        this.webviewReady = false;
        this.webviewReadyPromise = new Promise<void>((resolve) => {
            this.webviewReadyResolver = resolve;
        });

        this.configureWebview(panel.webview);
        panel.title = 'SAP LLM Chat - 준비 중';

        const messageDisposable = this.registerWebviewMessageHandler(panel.webview);
        panel.onDidDispose(() => {
            messageDisposable.dispose();
            if (this.webviewPanel === panel) {
                this.webviewPanel = null;
            }
            this.historySessionId = null;
        });
    }

    private extractBlockingAnswer(payload: any): string {
        return payload?.answer
            || payload?.data?.answer
            || payload?.external_response?.answer
            || payload?.result
            || '';
    }

    private extractStreamText(payload: any): string {
        if (typeof payload === 'string') {
            return payload;
        }

        return payload?.answer
            || payload?.text
            || payload?.delta
            || payload?.message
            || payload?.content
            || payload?.data?.answer
            || payload?.data?.text
            || payload?.data?.delta
            || payload?.data?.message
            || payload?.data?.content
            || '';
    }

    private async streamAgentResponse(
        response: Response,
        responseId: string,
        webview: vscode.Webview,
    ): Promise<void> {
        const contentType = response.headers.get('content-type') || '';

        if (!response.body) {
            return;
        }

        if (!contentType.includes('text/event-stream')) {
            const payload: any = await response.json();
            this.conversationId = payload?.conversation_id || this.conversationId;

            webview.postMessage({ type: 'stream-start', id: responseId });

            const fullText = this.extractBlockingAnswer(payload) || '❌ 응답 없음';
            for (const ch of fullText) {
                webview.postMessage({ type: 'stream-chunk', id: responseId, chunk: ch });
            }
            webview.postMessage({ type: 'stream-end', id: responseId });
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let started = false;

        while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

            const events = buffer.split('\n\n');
            buffer = events.pop() || '';

            for (const rawEvent of events) {
                const parsedChunk = this.parseCompanyStreamChunk(rawEvent);
                if (!parsedChunk) {
                    continue;
                }

                if (parsedChunk.conversationId) {
                    this.conversationId = parsedChunk.conversationId;
                }

                if (parsedChunk.done) {
                    continue;
                }

                if (!started) {
                    webview.postMessage({ type: 'stream-start', id: responseId });
                    started = true;
                }

                if (parsedChunk.text) {
                    webview.postMessage({
                        type: 'stream-chunk',
                        id: responseId,
                        chunk: parsedChunk.text
                    });
                }
            }

            if (done) {
                break;
            }
        }

        if (!started) {
            webview.postMessage({ type: 'stream-start', id: responseId });
            webview.postMessage({ type: 'stream-chunk', id: responseId, chunk: '❌ 응답 없음' });
        }

        webview.postMessage({ type: 'stream-end', id: responseId });
    }

    private finishActiveRequest() {
        this.activeRequestAbortController = null;
        this.activeResponseId = null;
    }

    private extractErrorMessage(payload: unknown): string | null {
        if (!payload) {
            return null;
        }

        if (typeof payload === 'string') {
            return payload.trim() || null;
        }

        if (typeof payload === 'object') {
            const record = payload as Record<string, unknown>;
            const candidates = [
                record.message,
                record.detail,
                record.error,
                record.reason,
                (record.data as Record<string, unknown> | undefined)?.message,
                (record.data as Record<string, unknown> | undefined)?.detail,
                (record.data as Record<string, unknown> | undefined)?.error
            ];

            for (const candidate of candidates) {
                if (typeof candidate === 'string' && candidate.trim()) {
                    return candidate.trim();
                }
            }
        }

        return null;
    }

    private async readErrorDetail(response: Response): Promise<string> {
        const raw = (await response.text()).trim();
        if (!raw) {
            return `${response.status} ${response.statusText}`.trim();
        }

        try {
            const parsed = JSON.parse(raw);
            const extracted = this.extractErrorMessage(parsed);
            if (extracted) {
                return extracted;
            }
        } catch {
            // keep raw body when response isn't JSON
        }

        return raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
    }

    /**
     * 💡 package.json에 선언된 설정값들을 실시간으로 가져오는 헬퍼 함수
     */
    private getAgentConfig() {
        const config = vscode.workspace.getConfiguration('companyAi');
        const rawBaseUrl = config.get<string>('apiBaseUrl') || 'https://devx-gw.shinsegae-inc.com/api';
        const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '');

        return {
            apiBaseUrl,
            clientId: config.get<string>('clientId') || '',
            clientSecret: config.get<string>('clientSecret') || '',
            agentId: config.get<string>('agentId') || '',
            agentCode: config.get<string>('agentCode') || '',
            agentUserId: config.get<string>('userId') || '',
            longResponseThresholdMs: Math.max(1000, config.get<number>('longResponseThresholdMs') || 10000),
            historyRetentionDays: Math.max(0, config.get<number>('historyRetentionDays') ?? CompanyAgentProvider.DEFAULT_HISTORY_RETENTION_DAYS),
            maxHistorySnapshots: Math.max(1, config.get<number>('maxHistorySnapshots') ?? CompanyAgentProvider.MAX_HISTORY_SNAPSHOTS)
        };
    }

    /**
     * 🔑 [API 1] Bearer Token 발급 API 호출
     */
    private async getAuthToken(): Promise<string> {
        if (this._authToken) {
            return this._authToken;
        }

        const { apiBaseUrl, clientId, clientSecret } = this.getAgentConfig();

        if (!clientId || !clientSecret) {
            vscode.window.showErrorMessage('VS Code 설정에서 사내 AI Client ID와 Secret을 먼저 입력해주세요 (Ctrl+,)');
            throw new Error('Missing credentials');
        }

        try {
            const body = new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret
            });

            const response = await axios.post(`${apiBaseUrl}/v1/auth/token`, body.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this._authToken = response.data.access_token;
            return this._authToken!;
        } catch (error) {
            const detail = axios.isAxiosError(error)
                ? `${error.response?.status ?? 'N/A'} ${JSON.stringify(error.response?.data ?? {})}`
                : String(error);
            vscode.window.showErrorMessage(`회사 AI 인증 토큰 발급 실패: ${detail}`);
            throw error;
        }
    }

    /**
     * 📁 [API 3] 파일 업로드 API 호출
     */
    private async uploadMaterialFile(
        token: string,
        fileName: string,
        content: string | Uint8Array,
        mimeType = 'text/plain'
    ): Promise<string> {
        const { apiBaseUrl } = this.getAgentConfig();
        try {
            const blobPart = typeof content === 'string'
                ? content
                : new Uint8Array(content);
            const uploadFile = new File([blobPart], fileName, {
                type: mimeType || 'application/octet-stream'
            });
            const formData = new FormData();
            formData.append('file', uploadFile);

            const response = await fetch(`${apiBaseUrl}/v1/agent/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const detail = await this.readErrorDetail(response);
                throw new Error(`파일 업로드 실패 (${response.status}): ${detail}`);
            }

            const payload = await response.json();
            return payload.material_id; // 서버에서 리턴한 파일 식별 ID
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`컨텍스트 파일 업로드 실패: ${detail}`);
            throw error;
        }
    }

    private getMimeTypeByFileName(fileName: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'txt':
            case 'abap':
            case 'js':
            case 'ts':
            case 'tsx':
            case 'jsx':
            case 'json':
            case 'xml':
            case 'md':
            case 'sql':
                return 'text/plain';
            case 'csv':
                return 'text/csv';
            case 'yaml':
            case 'yml':
                return 'text/yaml';
            default:
                return 'application/octet-stream';
        }
    }

    private getUploadFileName(fileName: string, mimeType?: string): string {
        const normalized = fileName.trim() || 'attachment';
        const lastDotIndex = normalized.lastIndexOf('.');
        const ext = lastDotIndex >= 0 ? normalized.slice(lastDotIndex + 1).toLowerCase() : '';
        const baseName = lastDotIndex > 0 ? normalized.slice(0, lastDotIndex) : normalized;
        const isTextLikeMime = typeof mimeType === 'string' && mimeType.startsWith('text/');
        const shouldForceTxt = CompanyAgentProvider.TEXT_UPLOAD_EXTENSIONS.has(ext) || isTextLikeMime;

        if (!shouldForceTxt) {
            return normalized;
        }

        return `${baseName || 'attachment'}.txt`;
    }

    private getUploadMimeType(fileName: string, mimeType?: string): string {
        const normalizedName = this.getUploadFileName(fileName, mimeType);
        if (normalizedName.toLowerCase().endsWith('.txt')) {
            return 'text/plain';
        }

        return mimeType || this.getMimeTypeByFileName(fileName);
    }

    public async attachExplorerFile(uri: vscode.Uri): Promise<void> {
        if (!uri) {
            vscode.window.showWarningMessage('첨부할 파일을 선택해주세요.');
            return;
        }

        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if ((stat.type & vscode.FileType.Directory) !== 0) {
                vscode.window.showInformationMessage('폴더는 첨부할 수 없습니다. 파일을 선택해주세요.');
                return;
            }

            if (stat.size > CompanyAgentProvider.MAX_ATTACHMENT_BYTES) {
                vscode.window.showErrorMessage('파일 크기가 커서 첨부할 수 없습니다. (최대 2MB)');
                return;
            }

            const fileBytes = await vscode.workspace.fs.readFile(uri);
            const fileName = uri.path.split('/').pop() || 'attachment';
            const attachment: WebviewAttachment = {
                name: fileName,
                mimeType: this.getMimeTypeByFileName(fileName),
                size: stat.size,
                contentBase64: Buffer.from(fileBytes).toString('base64')
            };

            const panel = await this.openChatPanel();
            await this.waitForWebviewReady();
            panel.webview.postMessage({ type: 'attachments-added', attachments: [attachment] });
            vscode.window.showInformationMessage(`채팅 첨부에 추가됨: ${fileName}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const panel = await this.openChatPanel();
            await this.waitForWebviewReady();
            panel.webview.postMessage({ type: 'attachment-error', message: `첨부 실패: ${message}` });
            vscode.window.showErrorMessage(`첨부 실패: ${message}`);
        }
    }

    private async uploadAttachments(token: string, attachments: WebviewAttachment[]): Promise<string[]> {
        const materialIds: string[] = [];

        for (const attachment of attachments) {
            const bytes = Buffer.from(attachment.contentBase64, 'base64');
            if (!bytes.length) {
                continue;
            }

            if (bytes.byteLength > CompanyAgentProvider.MAX_ATTACHMENT_BYTES) {
                throw new Error(`첨부 파일 크기 초과: ${attachment.name}`);
            }

            const uploadFileName = this.getUploadFileName(attachment.name, attachment.mimeType);
            const uploadMimeType = this.getUploadMimeType(attachment.name, attachment.mimeType);

            const materialId = await this.uploadMaterialFile(
                token,
                uploadFileName,
                bytes,
                uploadMimeType
            );
            materialIds.push(materialId);
        }

        return materialIds;
    }

    private truncateToByteLimit(content: string, maxBytes: number): { content: string; wasTruncated: boolean } {
        const encoder = new TextEncoder();
        if (encoder.encode(content).length <= maxBytes) {
            return { content, wasTruncated: false };
        }

        let end = content.length;
        let truncated = content;

        while (end > 0) {
            end = Math.floor(end * 0.8);
            truncated = content.slice(0, end);

            if (encoder.encode(truncated).length <= maxBytes) {
                break;
            }
        }

        return {
            content: `${truncated.trimEnd()}\n\n/* Context truncated to fit request size limits. */`,
            wasTruncated: true
        };
    }

    private getCodeContext(target?: SelectionActionTarget): SelectionAnalysisContext | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }

        if (target?.range) {
            return {
                text: editor.document.getText(target.range),
                sourceLabel: 'lens'
            };
        }

        if (!editor.selection.isEmpty) {
            return {
                text: editor.document.getText(editor.selection),
                sourceLabel: 'selection'
            };
        }

        return null;
    }

    private async submitPrompt(
        prompt: string,
        webview: vscode.Webview,
        attachments: WebviewAttachment[] = [],
        contextText?: string
    ): Promise<void> {
        const responseId = `assistant-${Date.now()}`;
        const abortController = new AbortController();
        this.activeRequestAbortController = abortController;
        this.activeResponseId = responseId;

        try {
            // 1단계: 사내 인증 토큰 확보
            const token = await this.getAuthToken();
            const { apiBaseUrl, agentId, agentCode, agentUserId } = this.getAgentConfig();

            // 2단계: 첨부 파일만 업로드하고, 선택 코드는 프롬프트에 직접 포함
            const materialIds: string[] = [];
            const safeContextText = typeof contextText === 'string' ? contextText : undefined;
            const inlineContext = safeContextText
                ? this.truncateToByteLimit(safeContextText, CompanyAgentProvider.MAX_CONTEXT_BYTES)
                : null;

            if (inlineContext?.wasTruncated) {
                vscode.window.showWarningMessage('선택한 코드가 너무 길어 앞부분만 전송합니다.');
            }

            materialIds.push(...await this.uploadAttachments(token, attachments));

            const finalPrompt = inlineContext
                ? `${prompt}\n\n[선택한 코드]\n${inlineContext.content}`
                : prompt;

            const response = await fetch(`${apiBaseUrl}/v1/agent/chat`, {
                method: 'POST',
                signal: abortController.signal,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream, application/json'
                },
                body: JSON.stringify({
                    query: finalPrompt,
                    user: agentUserId,
                    agent_id: agentId,
                    agent_code: agentCode,
                    response_mode: 'streaming',
                    conversation_id: this.conversationId,
                    project_id: null,
                    files: [],
                    materials: materialIds,
                    templates: [],
                    references: [],
                    knowledge_ids: []
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this._authToken = null;
                }
                if (response.status === 413) {
                    throw new Error('질문 또는 첨부된 컨텍스트 크기가 너무 커서 서버가 요청을 거절했습니다.');
                }

                const detail = await this.readErrorDetail(response);
                throw new Error(`API 응답 에러 (${response.status}): ${detail}`);
            }

            if (!response.body) {
                webview.postMessage({ type: 'stream-end', id: responseId });
                this.finishActiveRequest();
                return;
            }

            await this.streamAgentResponse(response, responseId, webview);
            this.finishActiveRequest();
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }

            console.error('Error in Extension Host:', error);
            const message = error instanceof Error
                ? error.message
                : '회사 AI Agent 통신 중 에러가 발생했습니다.';
            webview.postMessage({ type: 'stream-error', id: responseId, message, reason: 'error' });
            this.finishActiveRequest();
            vscode.window.showErrorMessage(message);
        }
    }

    private configureWebview(webview: vscode.Webview) {
        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'out', 'webview')
            ]
        };

        webview.html = this._getHtmlForWebview(webview);
    }

    private registerWebviewMessageHandler(webview: vscode.Webview): vscode.Disposable {
        return webview.onDidReceiveMessage(async (data) => {
            if (data.type === 'webview-ready') {
                this.webviewReady = true;
                this.webviewReadyResolver?.();
                this.webviewReadyResolver = null;
                this.webviewReadyPromise = null;
                if (this.webviewPanel) {
                    this.webviewPanel.title = 'SAP LLM Chat';
                }
                webview.postMessage({ type: 'init-history', messages: await this.loadChatHistoryFromWorkspace() });
                return;
            }

            if (data.type === 'history-updated') {
                await this.saveChatHistoryToWorkspace(data.messages);
                return;
            }

            if (data.type === 'load-history-request') {
                await this.showHistorySnapshotPickerAndLoad(webview);
                return;
            }

            if (data.type === 'cancel-submit') {
                if (this.activeRequestAbortController && this.activeResponseId) {
                    const canceledResponseId = this.activeResponseId;
                    this.activeRequestAbortController.abort();
                    this.finishActiveRequest();
                    webview.postMessage({
                        type: 'stream-error',
                        id: canceledResponseId,
                        message: '응답 생성을 취소했습니다.',
                        reason: 'canceled'
                    });
                }
                return;
            }

            if (data.type === 'user-submit') {
                await this.submitPrompt(
                    data.text,
                    webview,
                    Array.isArray(data.attachments) ? data.attachments : []
                );
                return;
            }

            if (data.type === 'export-file' || data.type === 'export-markdown') {
                const content = typeof data.content === 'string' ? data.content : '';
                if (!content.trim()) {
                    vscode.window.showInformationMessage('내보낼 채팅 내용이 없습니다.');
                    return;
                }

                const format = data.type === 'export-markdown'
                    ? 'md'
                    : (data.format === 'txt' ? 'txt' : 'md');
                const extension = format === 'txt' ? 'txt' : 'md';
                const filterLabel = format === 'txt' ? 'Text' : 'Markdown';
                const saveLabel = format === 'txt' ? '텍스트 저장' : 'Markdown 저장';

                const safeName = typeof data.fileName === 'string' && data.fileName.trim()
                    ? data.fileName.replace(/[\\/:*?"<>|]+/g, '-').trim()
                    : `sap-llm-chat-${new Date().toISOString().slice(0, 10)}`;

                const target = await vscode.window.showSaveDialog({
                    saveLabel,
                    filters: { [filterLabel]: [extension] },
                    defaultUri: vscode.Uri.file(`${safeName}.${extension}`)
                });

                if (!target) {
                    return;
                }

                const normalizedTarget = target.path.toLowerCase().endsWith(`.${extension}`)
                    ? target
                    : vscode.Uri.file(`${target.fsPath}.${extension}`);
                await vscode.workspace.fs.writeFile(normalizedTarget, new TextEncoder().encode(content));
                vscode.window.showInformationMessage(`채팅 내용을 저장했습니다: ${normalizedTarget.fsPath}`);
                return;
            }

        });
    }

    public async openChatPanel(): Promise<vscode.WebviewPanel> {
        if (this.webviewPanel) {
            this.ensureHistorySessionId();
            this.webviewPanel.reveal(undefined, false);
            return this.webviewPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'sapLlmChatPanel',
            'SAP LLM Chat - 준비 중',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'out', 'webview')]
            }
        );

        this.webviewPanel = panel;
        this.ensureHistorySessionId();
        this.webviewReady = false;
        this.webviewReadyPromise = new Promise<void>((resolve) => {
            this.webviewReadyResolver = resolve;
        });
        this.configureWebview(panel.webview);

        const messageDisposable = this.registerWebviewMessageHandler(panel.webview);
        panel.onDidDispose(() => {
            messageDisposable.dispose();
            if (this.webviewPanel === panel) {
                this.webviewPanel = null;
            }
            this.historySessionId = null;
        });

        return panel;
    }

    public async openChatPanelIfMissing(): Promise<void> {
        if (this.webviewPanel || this.hasChatPanelTabInWorkbench()) {
            return;
        }

        await this.openChatPanel();
    }

    private hasChatPanelTabInWorkbench(): boolean {
        return vscode.window.tabGroups.all.some((group) =>
            group.tabs.some((tab) =>
                tab.input instanceof vscode.TabInputWebview
                && tab.input.viewType === 'sapLlmChatPanel'
            )
        );
    }

    public async runSelectionAction(
        prompt: string,
        userVisibleText: string,
        target?: SelectionActionTarget
    ): Promise<void> {
        const context = this.getCodeContext(target);
        if (!context) {
            vscode.window.showInformationMessage('분석할 코드 선택 또는 함수/메서드 위치로 커서를 이동해주세요.');
            return;
        }

        const panel = await this.openChatPanel();
        await this.waitForWebviewReady();
        const targetWebview = panel.webview;

        targetWebview.postMessage({ type: 'external-submit', text: userVisibleText });
        await this.submitPrompt(prompt, targetWebview, [], context.text);
    }

    private async waitForWebviewReady(): Promise<void> {
        if (this.webviewReady) {
            return;
        }

        await this.webviewReadyPromise;
    }

    /**
     * 사내 인프라 표준 스트리밍 규격 파싱 함수 (필요시 커스텀 변경)
     */
    private parseCompanyStreamChunk(chunk: string): { text: string; conversationId?: string; done?: boolean } | null {
        const dataLines = chunk
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .filter(Boolean);

        if (!dataLines.length) {
            return null;
        }

        const payloadText = dataLines.join('\n');
        if (payloadText === '[DONE]') {
            return { text: '', done: true };
        }

        try {
            const payload = JSON.parse(payloadText);
            return {
                text: this.extractStreamText(payload),
                conversationId: payload?.conversation_id || payload?.data?.conversation_id,
                done: payload?.event === 'message_end' || payload?.type === 'done'
            };
        } catch {
            return { text: payloadText };
        }
    }

    /**
     * React 빌드 산출물(Vite Build) 파일들을 웹뷰 URI 규격에 맞춰 로드하는 HTML 템플릿 생성
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Vite 빌드 폴더 맵핑 (Vite 설정의 outDir 기준: out/webview)
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'assets', 'index.js')
        );
        const { longResponseThresholdMs } = this.getAgentConfig();
        const initialConfig = JSON.stringify({ longResponseThresholdMs });

        return `<!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Company AI Assistant</title>
            <style>
                body {
                    padding: 0;
                    margin: 0;
                    background-color: var(--vscode-sideBar-background);
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                }

                #boot {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background:
                        radial-gradient(circle at top right, color-mix(in srgb, var(--vscode-focusBorder) 18%, transparent), transparent 40%),
                        var(--vscode-sideBar-background);
                    transition: opacity 160ms ease;
                }

                .boot-card {
                    width: min(360px, calc(100vw - 32px));
                    padding: 18px 20px;
                    border-radius: 14px;
                    border: 1px solid var(--vscode-widget-border);
                    background: color-mix(in srgb, var(--vscode-editorWidget-background) 92%, transparent);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
                }

                .boot-title {
                    font-size: calc(var(--vscode-font-size) + 1px);
                    font-weight: 600;
                    margin-bottom: 8px;
                }

                .boot-text {
                    font-size: calc(var(--vscode-font-size) - 1px);
                    color: var(--vscode-descriptionForeground);
                }

                .boot-bar {
                    margin-top: 14px;
                    height: 4px;
                    border-radius: 999px;
                    overflow: hidden;
                    background: color-mix(in srgb, var(--vscode-widget-border) 70%, transparent);
                }

                .boot-bar > span {
                    display: block;
                    width: 38%;
                    height: 100%;
                    border-radius: inherit;
                    background: var(--vscode-progressBar-background);
                    animation: boot-slide 1.1s ease-in-out infinite;
                }

                @keyframes boot-slide {
                    0% { transform: translateX(-120%); }
                    100% { transform: translateX(320%); }
                }
            </style>
        </head>
        <body>
            <div id="boot">
                <div class="boot-card">
                    <div class="boot-title">SAP LLM Chat 준비 중</div>
                    <div class="boot-text">채팅 패널과 분석 도구를 불러오고 있습니다.</div>
                    <div class="boot-bar"><span></span></div>
                </div>
            </div>
            <div id="root"></div>
            <script>
                window.companyAiConfig = ${initialConfig};
                window.addEventListener('sap-llm-ready', () => {
                    const boot = document.getElementById('boot');
                    if (boot) {
                        boot.style.opacity = '0';
                        setTimeout(() => boot.remove(), 180);
                    }
                }, { once: true });
            </script>
            <script type="module" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}
