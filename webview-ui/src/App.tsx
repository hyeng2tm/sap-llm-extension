import React, { useEffect, useMemo, useRef, useState } from "react";

const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;
const companyAiConfig = (window as any).companyAiConfig ?? { longResponseThresholdMs: 10000 };

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  kind?: "error" | "canceled";
  statusText?: string;
}

interface PendingAttachment {
  name: string;
  mimeType: string;
  size: number;
  contentBase64: string;
}

type ContentSegment =
  | { type: "text"; value: string }
  | { type: "code"; value: string; language: string };

type ExportFormat = "md" | "txt";
const MAX_HISTORY_MESSAGES = 200;

function sanitizeHistoryMessages(messages: unknown): Message[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry, index) => {
      const role = entry.role === "user" || entry.role === "assistant" || entry.role === "system"
        ? entry.role
        : "system";
      const kind = entry.kind === "error" || entry.kind === "canceled"
        ? entry.kind
        : undefined;
      return {
        id: typeof entry.id === "string" && entry.id.trim() ? entry.id : `history-${Date.now()}-${index}`,
        role,
        content: typeof entry.content === "string" ? entry.content : "",
        kind,
        statusText: typeof entry.statusText === "string" ? entry.statusText : undefined
      };
    })
    .slice(-MAX_HISTORY_MESSAGES);
}

function splitContentSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const regex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;
    if (matchStart > cursor) {
      segments.push({ type: "text", value: content.slice(cursor, matchStart) });
    }

    segments.push({
      type: "code",
      language: match[1] || "text",
      value: match[2] || ""
    });
    cursor = matchEnd;
  }

  if (cursor < content.length) {
    segments.push({ type: "text", value: content.slice(cursor) });
  }

  return segments.length ? segments : [{ type: "text", value: content }];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getKeywordPattern(language: string): string {
  const lang = language.toLowerCase();
  const map: Record<string, string> = {
    ts: "break|case|catch|class|const|continue|default|else|enum|export|extends|false|finally|for|function|if|implements|import|in|instanceof|interface|let|new|null|private|protected|public|return|static|super|switch|this|throw|true|try|type|typeof|var|void|while",
    typescript: "break|case|catch|class|const|continue|default|else|enum|export|extends|false|finally|for|function|if|implements|import|in|instanceof|interface|let|new|null|private|protected|public|return|static|super|switch|this|throw|true|try|type|typeof|var|void|while",
    js: "break|case|catch|class|const|continue|default|else|export|extends|false|finally|for|function|if|import|in|instanceof|let|new|null|return|super|switch|this|throw|true|try|typeof|var|while",
    javascript: "break|case|catch|class|const|continue|default|else|export|extends|false|finally|for|function|if|import|in|instanceof|let|new|null|return|super|switch|this|throw|true|try|typeof|var|while",
    python: "and|as|assert|async|await|break|class|continue|def|elif|else|except|False|finally|for|from|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield",
    sql: "select|from|where|join|left|right|inner|outer|on|group|by|order|insert|into|update|delete|create|alter|drop|table|view|index|distinct|having|limit|as|and|or|not|null|case|when|then|end",
    abap: "DATA|TYPES|CLASS|METHOD|ENDMETHOD|ENDCLASS|SELECT|FROM|WHERE|LOOP|ENDLOOP|IF|ELSE|ENDIF|TRY|CATCH|ENDTRY|CALL|FUNCTION|FORM|ENDFORM|WRITE|APPEND|READ|TABLE|INTO|ASSIGNING|FIELD-SYMBOL"
  };

  return map[lang] ?? "";
}

function highlightCodeToHtml(code: string, language: string): string {
  const keywords = getKeywordPattern(language);
  const keywordPart = keywords ? `\\b(?:${keywords})\\b` : "(?!x)x";
  const tokenRegex = new RegExp(
    `(#.*$|--.*$|\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*$|\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|${keywordPart})`,
    "gm"
  );

  let html = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    const full = match[0];
    const index = match.index;
    if (index > cursor) {
      html += escapeHtml(code.slice(cursor, index));
    }

    const escaped = escapeHtml(full);
    if (full.startsWith("//") || full.startsWith("#") || full.startsWith("--") || full.startsWith("/*")) {
      html += `<span class=\"sap-llm-token-comment\">${escaped}</span>`;
    } else if (full.startsWith("\"") || full.startsWith("'")) {
      html += `<span class=\"sap-llm-token-string\">${escaped}</span>`;
    } else {
      html += `<span class=\"sap-llm-token-keyword\">${escaped}</span>`;
    }

    cursor = index + full.length;
  }

  if (cursor < code.length) {
    html += escapeHtml(code.slice(cursor));
  }

  return html;
}

export default function App() {
  const messageFontSize = "calc(var(--vscode-font-size) - 1px)";
  const labelFontSize = "calc(var(--vscode-font-size) - 2px)";
  const metaFontSize = "calc(var(--vscode-font-size) - 3px)";
  const inputFontSize = "calc(var(--vscode-font-size) - 1px)";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyReadyRef = useRef(false);
  const historySyncTimerRef = useRef<number | null>(null);

  const textAreaDisabledProps = isSending ? { disabled: true } : {};

  const mergeAttachments = (existing: PendingAttachment[], incoming: PendingAttachment[]) => {
    const next = [...existing];
    const existingKeys = new Set(existing.map((file) => `${file.name}:${file.size}`));

    for (const file of incoming) {
      const key = `${file.name}:${file.size}`;
      if (existingKeys.has(key)) {
        continue;
      }
      existingKeys.add(key);
      next.push(file);
    }

    return next;
  };

  const escapeMarkdown = (value: string) => value.replace(/```/g, "`\u200b``");

  const buildMarkdownExport = (targetMessages: Message[]) => {
    const lines: string[] = [];
    lines.push("# SAP LLM Chat Export");
    lines.push("");
    lines.push(`- Exported At: ${new Date().toLocaleString()}`);
    lines.push("");

    targetMessages.forEach((msg, index) => {
      const roleLabel = msg.role === "assistant" ? "Assistant" : msg.role === "user" ? "User" : "System";
      lines.push(`## ${index + 1}. ${roleLabel}`);
      lines.push("");
      lines.push("```text");
      lines.push(escapeMarkdown(msg.content || ""));
      lines.push("```");

      if (msg.statusText) {
        lines.push("");
        lines.push(`Status: ${msg.statusText}`);
      }
      lines.push("");
    });

    return lines.join("\n");
  };

  const buildTextExport = (targetMessages: Message[]) => {
    const lines: string[] = [];
    lines.push("SAP LLM Chat Export");
    lines.push(`Exported At: ${new Date().toLocaleString()}`);
    lines.push("");

    targetMessages.forEach((msg, index) => {
      const roleLabel = msg.role === "assistant" ? "Assistant" : msg.role === "user" ? "User" : "System";
      lines.push(`[${index + 1}] ${roleLabel}`);
      lines.push(msg.content || "");
      if (msg.statusText) {
        lines.push(`Status: ${msg.statusText}`);
      }
      lines.push("");
    });

    return lines.join("\n");
  };

  const exportChat = (targetMessages: Message[], fileName: string, format: ExportFormat) => {
    if (targetMessages.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: `export-empty-${Date.now()}`,
          role: "system",
          content: "내보낼 채팅 내용이 없습니다.",
          kind: "error"
        }
      ]);
      return;
    }

    const content = format === "md" ? buildMarkdownExport(targetMessages) : buildTextExport(targetMessages);
    vscode?.postMessage({ type: "export-file", fileName, format, content });
  };

  const handleExportAllMarkdown = () => {
    exportChat(messages, `sap-llm-chat-${new Date().toISOString().slice(0, 10)}`, "md");
  };

  const handleExportAssistantMessage = (msg: Message, format: ExportFormat) => {
    exportChat([msg], `sap-llm-response-${new Date().toISOString().replace(/[:.]/g, "-")}`, format);
  };

  const handleLoadHistory = () => {
    vscode?.postMessage({ type: "load-history-request" });
  };

  const handleCopyCode = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const renderMessageContent = (content: string) => {
    const segments = splitContentSegments(content);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {segments.map((segment, index) => {
          if (segment.type === "code") {
            return (
              <div key={`code-${index}`} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px"
                  }}
                >
                  <div
                    style={{
                      fontSize: "calc(var(--vscode-font-size) - 3px)",
                      color: "var(--vscode-descriptionForeground)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em"
                    }}
                  >
                    {segment.language}
                  </div>
                  <vscode-button
                    appearance="icon"
                    title="코드 복사"
                    aria-label="코드 복사"
                    onClick={() => handleCopyCode(segment.value)}
                    style={{ height: "22px", minWidth: "22px", width: "22px" }}
                  >
                    <span aria-hidden="true" style={{ display: "inline-flex", width: "14px", height: "14px" }}>
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="3" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                        <rect x="2" y="6" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                      </svg>
                    </span>
                  </vscode-button>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--vscode-editorWidget-border)",
                    background: "var(--vscode-textCodeBlock-background)",
                    color: "var(--vscode-textPreformat-foreground)",
                    fontFamily: "var(--vscode-editor-font-family)",
                    fontSize: "calc(var(--vscode-editor-font-size) - 1px)",
                    lineHeight: 1.5,
                    overflowX: "auto",
                    whiteSpace: "pre"
                  }}
                >
                  <code dangerouslySetInnerHTML={{ __html: highlightCodeToHtml(segment.value, segment.language) }} />
                </pre>
              </div>
            );
          }

          return (
            <div key={`text-${index}`} style={{ whiteSpace: "pre-wrap" }}>
              {segment.value}
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isSending) {
      setIsTakingLong(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setIsTakingLong(true);
    }, Math.max(1000, Number(companyAiConfig.longResponseThresholdMs) || 10000));

    return () => window.clearTimeout(timer);
  }, [isSending]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case "stream-start":
          setIsSending(true);
          setIsTakingLong(false);
          setActiveAssistantId(message.id);
          setMessages((prev) =>
            prev.some((msg) => msg.id === message.id)
              ? prev
              : [...prev, { id: message.id, role: "assistant", content: "" }]
          );
          break;

        case "init-history":
          setMessages(sanitizeHistoryMessages(message.messages));
          setIsSending(false);
          setIsTakingLong(false);
          setActiveAssistantId(null);
          historyReadyRef.current = true;
          break;

        case "history-loaded": {
          const loadedMessages = sanitizeHistoryMessages(message.messages);
          setMessages([
            ...loadedMessages,
            {
              id: `history-loaded-${Date.now()}`,
              role: "system",
              content: message.sourceName
                ? `히스토리를 불러왔습니다: ${message.sourceName}`
                : "히스토리를 불러왔습니다."
            }
          ]);
          setIsSending(false);
          setIsTakingLong(false);
          setActiveAssistantId(null);
          historyReadyRef.current = true;
          break;
        }

        case "history-load-error":
          setMessages((prev) => [
            ...prev,
            {
              id: `history-load-error-${Date.now()}`,
              role: "system",
              content: message.message || "히스토리 불러오기에 실패했습니다.",
              kind: "error"
            }
          ]);
          break;

        case "stream-chunk":
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === message.id ? { ...msg, content: msg.content + message.chunk } : msg
            )
          );
          break;

        case "stream-end":
          setIsSending(false);
          setActiveAssistantId(null);
          break;

        case "stream-error":
          setIsSending(false);
          setActiveAssistantId(null);
          if (message.reason === "canceled") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === message.id
                  ? {
                      ...msg,
                      statusText: message.message || "응답 생성을 취소했습니다.",
                      kind: "canceled"
                    }
                  : msg
              )
            );
            break;
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `${message.id}-error`,
              role: "system",
              content: message.message || "응답 처리 중 오류가 발생했습니다.",
              kind: "error"
            }
          ]);
          break;

        case "external-submit":
          setMessages((prev) => [
            ...prev,
            {
              id: `user-${Date.now()}`,
              role: "user",
              content: message.text || "선택한 코드를 분석해줘."
            }
          ]);
          setIsSending(true);
          setInput("");
          setInputKey((prev) => prev + 1);
          if (inputRef.current) {
            inputRef.current.value = "";
          }
          break;

        case "attachments-added":
          setAttachments((prev) => mergeAttachments(prev, Array.isArray(message.attachments) ? message.attachments : []));
          break;

        case "attachment-error":
          setMessages((prev) => [
            ...prev,
            {
              id: `attachment-error-${Date.now()}`,
              role: "system",
              content: message.message || "파일 첨부 중 오류가 발생했습니다.",
              kind: "error"
            }
          ]);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      vscode?.postMessage({ type: "webview-ready" });
      window.dispatchEvent(new Event("sap-llm-ready"));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!historyReadyRef.current) {
      return;
    }

    if (historySyncTimerRef.current !== null) {
      window.clearTimeout(historySyncTimerRef.current);
    }

    historySyncTimerRef.current = window.setTimeout(() => {
      const compactMessages = messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        kind: msg.kind,
        statusText: msg.statusText
      })).slice(-MAX_HISTORY_MESSAGES);
      vscode?.postMessage({ type: "history-updated", messages: compactMessages });
    }, 250);

    return () => {
      if (historySyncTimerRef.current !== null) {
        window.clearTimeout(historySyncTimerRef.current);
      }
    };
  }, [messages]);

  const handleSend = () => {
    if (isSending) {
      return;
    }

    const trimmedInput = input.trim();
    if (!trimmedInput && attachments.length === 0) {
      return;
    }

    const submittedText = trimmedInput || `첨부한 파일 ${attachments.length}개를 분석해줘.`;
    const attachmentSummary = attachments.length > 0
      ? `\n\n첨부: ${attachments.map((file) => file.name).join(", ")}`
      : "";

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: `${submittedText}${attachmentSummary}`
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    vscode?.postMessage({ type: "user-submit", text: submittedText, attachments });
    setInput("");
    setInputKey((prev) => prev + 1);
    setAttachments([]);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey || isSending) {
      return;
    }

    event.preventDefault();
    handleSend();
  };

  const handleCancel = () => {
    if (!isSending) {
      return;
    }

    vscode?.postMessage({ type: "cancel-submit" });
  };

  const readFileAsBase64 = (file: File) => new Promise<PendingAttachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`파일을 읽지 못했습니다: ${file.name}`));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`파일을 읽지 못했습니다: ${file.name}`));
        return;
      }

      const [, contentBase64 = ""] = result.split(",", 2);
      resolve({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        contentBase64
      });
    };
    reader.readAsDataURL(file);
  });

  const handleAttachmentPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    try {
      const uploadedFiles = await Promise.all(files.map(readFileAsBase64));
      setAttachments((prev) => mergeAttachments(prev, uploadedFiles));
    } catch (error) {
      const message = error instanceof Error ? error.message : "파일 첨부 중 오류가 발생했습니다.";
      setMessages((prev) => [
        ...prev,
        { id: `attachment-error-${Date.now()}`, role: "system", content: message, kind: "error" }
      ]);
    } finally {
      event.target.value = "";
    }
  };

  const handleRemoveAttachment = (name: string, size: number) => {
    setAttachments((prev) => prev.filter((file) => !(file.name === name && file.size === size)));
  };

  const assistantCount = useMemo(() => messages.filter((msg) => msg.role === "assistant").length, [messages]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        padding: "8px",
        boxSizing: "border-box",
        fontFamily: "var(--vscode-font-family)",
        fontSize: "var(--vscode-font-size)",
        fontWeight: "var(--vscode-font-weight)"
      }}
    >
      <style>{`
        :root {
          color-scheme: dark;
        }

        .sap-llm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          margin-bottom: 8px;
          border: 1px solid var(--vscode-widget-border);
          border-radius: 14px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--vscode-editorWidget-background) 90%, transparent), color-mix(in srgb, var(--vscode-sideBar-background) 84%, transparent));
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
        }

        .sap-llm-header-title {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sap-llm-header-badge {
          padding: 3px 8px;
          border-radius: 999px;
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          font-size: calc(var(--vscode-font-size) - 3px);
          border: 1px solid var(--vscode-panel-border);
          white-space: nowrap;
        }

        .sap-llm-attachment-chip:hover {
          border-color: var(--vscode-focusBorder);
        }

        @keyframes typing-pulse {
          0%, 80%, 100% { opacity: 0.28; transform: scale(0.9); }
          40% { opacity: 0.9; transform: scale(1); }
        }

        .sap-llm-token-keyword {
          color: var(--vscode-symbolIcon-keywordForeground);
          font-weight: 600;
        }

        .sap-llm-token-string {
          color: var(--vscode-terminal-ansiGreen);
        }

        .sap-llm-token-comment {
          color: var(--vscode-descriptionForeground);
          font-style: italic;
        }
      `}</style>

      <div className="sap-llm-header">
        <div className="sap-llm-header-title">
          <div style={{ fontSize: "calc(var(--vscode-font-size) + 2px)", fontWeight: 700 }}>
            SAP LLM Chat
          </div>
          <div style={{ color: "var(--vscode-descriptionForeground)", fontSize: metaFontSize }}>
            AI 응답 {assistantCount}건 | 코드 블록은 별도 스타일로 표시됩니다.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <vscode-button
            appearance="icon"
            title="히스토리 불러오기"
            aria-label="히스토리 불러오기"
            onClick={handleLoadHistory}
            style={{ height: "24px", minWidth: "24px", width: "24px" }}
            {...textAreaDisabledProps}
          >
            <span aria-hidden="true" style={{ display: "inline-flex", width: "14px", height: "14px" }}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 2.2A5.8 5.8 0 1 1 2.2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M2.2 3.4V8H6.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 5.2V8L10.2 9.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </vscode-button>
          <vscode-button
            appearance="icon"
            title="전체 Markdown 다운로드"
            aria-label="전체 Markdown 다운로드"
            onClick={handleExportAllMarkdown}
            style={{ height: "24px", minWidth: "24px", width: "24px" }}
            {...textAreaDisabledProps}
          >
            <span aria-hidden="true" style={{ display: "inline-flex", width: "14px", height: "14px" }}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 2.5V10.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M5.5 7.8L8 10.3L10.5 7.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="2.5" y="11.5" width="11" height="2" rx="0.8" fill="currentColor"/>
              </svg>
            </span>
          </vscode-button>
          <div className="sap-llm-header-badge">Ready</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", marginBottom: "8px" }}>
        {messages.length === 0 && !isSending && (
          <div
            style={{
              minHeight: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 12px"
            }}
          >
            <div
              style={{
                width: "min(420px, 100%)",
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid var(--vscode-widget-border)",
                background:
                  "linear-gradient(160deg, color-mix(in srgb, var(--vscode-editorWidget-background) 92%, transparent), color-mix(in srgb, var(--vscode-sideBar-background) 88%, transparent))",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.12)"
              }}
            >
              <div style={{ fontSize: "calc(var(--vscode-font-size) + 2px)", fontWeight: 700, marginBottom: "8px" }}>
                SAP LLM Chat
              </div>
              <div style={{ color: "var(--vscode-descriptionForeground)", marginBottom: "14px", lineHeight: 1.5 }}>
                코드를 선택한 뒤 CodeLens 또는 우클릭 메뉴의 코드 분석을 실행하거나, 아래 입력창에서 직접 질문할 수 있습니다.
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isActiveAssistant = msg.role === "assistant" && msg.id === activeAssistantId;
          const showTypingIndicator = isActiveAssistant && isSending;
          const isCanceled = msg.kind === "canceled";
          const isSystemError = msg.role === "system";
          const showStatusTag = msg.role === "assistant" && !!msg.statusText;
          const isUser = msg.role === "user";
          const isAssistant = msg.role === "assistant";
          const rowJustifyContent = isUser ? "flex-end" : isAssistant ? "flex-start" : "center";
          const bubbleBackgroundColor = isUser
            ? "var(--vscode-button-background)"
            : isSystemError
              ? "var(--vscode-inputValidation-errorBackground)"
              : "var(--vscode-editorWidget-background)";
          const bubbleBorderColor = isUser
            ? "var(--vscode-button-border)"
            : isSystemError
              ? "var(--vscode-inputValidation-errorBorder)"
              : "var(--vscode-widget-border)";
          const bubbleTextColor = isUser
            ? "var(--vscode-button-foreground)"
            : isCanceled
              ? "var(--vscode-testing-iconQueued)"
              : isSystemError
                ? "var(--vscode-inputValidation-errorForeground)"
                : "var(--vscode-foreground)";
          const bubbleWidth = isSystemError ? "min(100%, 560px)" : "min(88%, 560px)";

          return (
            <div
              key={msg.id}
              style={{
                marginBottom: "12px",
                display: "flex",
                justifyContent: rowJustifyContent
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: bubbleWidth }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px"
                  }}
                >
                  <div
                    style={{
                      fontWeight: "bold",
                      color:
                        isUser
                          ? "var(--vscode-textLink-activeColor)"
                          : isCanceled
                            ? "var(--vscode-testing-iconQueued)"
                            : isSystemError
                              ? "var(--vscode-errorForeground)"
                              : "var(--vscode-textPreformat-foreground)",
                      marginBottom: "2px",
                      fontSize: labelFontSize,
                      letterSpacing: "0.01em",
                      textAlign: isUser ? "right" : isSystemError ? "center" : "left"
                    }}
                  >
                    {isUser ? "User" : isCanceled ? "Canceled" : msg.role === "system" ? "System" : "Assistant"}
                  </div>
                </div>

                <div
                  style={{
                    fontFamily: "var(--vscode-editor-font-family)",
                    fontSize: messageFontSize,
                    lineHeight: 1.55,
                    color: bubbleTextColor,
                    backgroundColor: bubbleBackgroundColor,
                    border: `1px solid ${bubbleBorderColor}`,
                    borderRadius: isUser ? "16px 16px 4px 16px" : isSystemError ? "12px" : "16px 16px 16px 4px",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.08)"
                  }}
                >
                  {renderMessageContent(msg.content)}

                  {showStatusTag && (
                    <div
                      style={{
                        alignSelf: "flex-start",
                        padding: "3px 8px",
                        borderRadius: "999px",
                        border: "1px solid var(--vscode-panel-border)",
                        backgroundColor: isCanceled
                          ? "var(--vscode-badge-background)"
                          : "var(--vscode-editorInfo-background)",
                        color: isCanceled
                          ? "var(--vscode-badge-foreground)"
                          : "var(--vscode-editorInfo-foreground)",
                        fontSize: metaFontSize,
                        lineHeight: 1.4
                      }}
                    >
                      {msg.statusText}
                    </div>
                  )}

                  {showTypingIndicator && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "var(--vscode-descriptionForeground)",
                        backgroundColor: "var(--vscode-editorWidget-background)",
                        border: "1px solid var(--vscode-widget-border)",
                        borderRadius: "10px",
                        padding: "6px 10px",
                        alignSelf: "flex-start"
                      }}
                    >
                      <div style={{ display: "flex", gap: "4px" }}>
                        {[0, 1, 2].map((index) => (
                          <span
                            key={index}
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "999px",
                              backgroundColor: index === 1
                                ? "var(--vscode-progressBar-background)"
                                : "var(--vscode-descriptionForeground)",
                              boxShadow: "0 0 0 1px color-mix(in srgb, var(--vscode-editorWidget-border) 65%, transparent)",
                              animation: `typing-pulse 1.2s ease-in-out ${index * 0.18}s infinite`
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ color: "var(--vscode-foreground)" }}>
                        {isTakingLong ? "응답이 오래 걸리는 중입니다..." : "응답을 생성하고 있습니다..."}
                      </span>
                    </div>
                  )}

                  {isAssistant && !showTypingIndicator && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                      <vscode-button
                        appearance="icon"
                        title="Markdown 다운로드"
                        aria-label="Markdown 다운로드"
                        onClick={() => handleExportAssistantMessage(msg, "md")}
                        {...textAreaDisabledProps}
                        style={{ height: "24px", minWidth: "24px", width: "24px" }}
                      >
                        <span aria-hidden="true" style={{ display: "inline-flex", width: "14px", height: "14px" }}>
                          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 2.5V10.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            <path d="M5.5 7.8L8 10.3L10.5 7.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <rect x="2.5" y="11.5" width="11" height="2" rx="0.8" fill="currentColor"/>
                          </svg>
                        </span>
                      </vscode-button>
                      <vscode-button
                        appearance="icon"
                        title="텍스트 다운로드"
                        aria-label="텍스트 다운로드"
                        onClick={() => handleExportAssistantMessage(msg, "txt")}
                        {...textAreaDisabledProps}
                        style={{ height: "24px", minWidth: "24px", width: "24px" }}
                      >
                        <span aria-hidden="true" style={{ display: "inline-flex", width: "14px", height: "14px" }}>
                          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="2.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                            <path d="M5.2 5.3H10.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                            <path d="M5.2 7.8H10.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                            <path d="M5.2 10.3H8.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                        </span>
                      </vscode-button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleAttachmentPick} />

      {attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
          {attachments.map((file) => (
            <button
              key={`${file.name}-${file.size}`}
              type="button"
              className="sap-llm-attachment-chip"
              onClick={() => handleRemoveAttachment(file.name, file.size)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "999px",
                border: "1px solid var(--vscode-widget-border)",
                background: "var(--vscode-editorWidget-background)",
                color: "var(--vscode-foreground)",
                cursor: "pointer",
                fontSize: metaFontSize
              }}
            >
              <span>📎 {file.name}</span>
              <span style={{ color: "var(--vscode-descriptionForeground)" }}>×</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
        <vscode-text-area
          key={inputKey}
          ref={inputRef}
          value={input}
          onInput={(e: any) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ask AI or type commands..."
          style={{
            flex: 1,
            fontFamily: "var(--vscode-font-family)",
            fontSize: inputFontSize,
            fontWeight: "var(--vscode-font-weight)"
          }}
          rows={2}
          {...textAreaDisabledProps}
        />

        <vscode-button
          appearance="secondary"
          onClick={() => fileInputRef.current?.click()}
          style={{ height: "100%" }}
          {...textAreaDisabledProps}
        >
          Attach
        </vscode-button>

        <vscode-button
          onClick={handleSend}
          style={{ height: "100%" }}
          {...(isSending || (!input.trim() && attachments.length === 0) ? { disabled: true } : {})}
        >
          {isSending ? "Sending..." : "Send"}
        </vscode-button>

        {isSending && (
          <vscode-button onClick={handleCancel} appearance="secondary" style={{ height: "100%" }}>
            Cancel
          </vscode-button>
        )}
      </div>

      <div
        style={{
          minHeight: "18px",
          marginTop: "6px",
          color: "var(--vscode-descriptionForeground)",
          fontSize: metaFontSize
        }}
      >
        {isSending
          ? isTakingLong
            ? "응답이 오래 걸리는 중입니다. 필요하면 Cancel로 중단할 수 있습니다."
            : "AI가 응답을 생성하는 중입니다..."
          : "Enter로 전송, Shift+Enter로 줄바꿈"}
      </div>
    </div>
  );
}