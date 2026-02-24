import { Suspense, useCallback, useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { isToolUIPart, getToolName } from "ai";
import type { UIMessage } from "ai";
import {
  Button,
  Badge,
  InputArea,
  Empty,
  Surface,
  Text
} from "@cloudflare/kumo";
import {
  PaperPlaneRightIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  GearIcon,
  InfinityIcon
} from "@phosphor-icons/react";
import { ConnectionIndicator, ModeToggle, type ConnectionStatus } from "./ui";

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { type: "text"; text: string }).text)
    .join("");
}

function Chat() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agent = useAgent({
    agent: "ForeverChatAgent",
    onOpen: useCallback(() => setConnectionStatus("connected"), []),
    onClose: useCallback(() => setConnectionStatus("disconnected"), []),
    onError: useCallback((error: Event) => console.error("WebSocket error:", error), [])
  });

  const {
    messages,
    sendMessage,
    clearHistory,
    addToolApprovalResponse,
    status
  } = useAgentChat({
    agent,
    body: { clientVersion: "1.0.0" },
    onToolCall: async ({ toolCall, addToolOutput }) => {
      if (toolCall.toolName === "getUserTimezone") {
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          output: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            localTime: new Date().toLocaleTimeString()
          }
        });
      }
    }
  });

  const isStreaming = status === "streaming";
  const isConnected = connectionStatus === "connected";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage({
      role: "user",
      parts: [{ type: "text", text }]
    });
  }, [input, isStreaming, sendMessage]);

  return (
    <div className="flex h-[100dvh] flex-col bg-kumo-elevated selection:bg-kumo-brand selection:text-white">
      <header className="sticky top-0 z-10 border-b border-kumo-line bg-kumo-base/90 px-4 py-3 backdrop-blur-md md:px-6 md:py-4">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            <h1 className="text-base font-bold tracking-tight text-kumo-default md:text-xl">
              Forever Chat
            </h1>
            <Badge variant="primary" className="hidden items-center sm:inline-flex">
              <InfinityIcon size={14} weight="bold" className="mr-1.5" />
              Durable Streaming
            </Badge>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <ConnectionIndicator status={connectionStatus} />
            <ModeToggle />
            <Button
              variant="secondary"
              icon={<TrashIcon size={16} />}
              onClick={clearHistory}
              title="Clear Chat"
              className="hidden sm:inline-flex"
            >
              Clear
            </Button>
            <Button
              variant="secondary"
              icon={<TrashIcon size={18} />}
              onClick={clearHistory}
              title="Clear Chat"
              className="px-2 sm:hidden"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {messages.length === 0 && (
            <div className="mt-8 md:mt-16">
              <Empty
                icon={<InfinityIcon size={40} className="text-kumo-brand" />}
                title="Durable Edge Intelligence"
                description="Experience persistent, serverless inference via Cloudflare Workers AI. Powered by GLM-4.7-Flash models with deep tool execution."
              />
            </div>
          )}

          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isLastAssistant = message.role === "assistant" && index === messages.length - 1;

            return (
              <div key={message.id} className="space-y-2">
                {isUser ? (
                  <div className="flex justify-end">
                    <div className="max-w-[92%] rounded-2xl rounded-tr-sm bg-kumo-brand px-4 py-3 text-sm leading-relaxed text-white shadow-sm md:max-w-[80%] md:text-base">
                      {getMessageText(message)}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-kumo-line bg-kumo-base px-4 py-3 text-sm leading-relaxed text-kumo-default shadow-sm md:max-w-[80%] md:text-base">
                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words md:prose-base">
                        {getMessageText(message)}
                        {isLastAssistant && isStreaming && (
                          <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-kumo-brand align-middle" />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {message.parts
                  .filter((part) => isToolUIPart(part))
                  .map((part) => {
                    if (!isToolUIPart(part)) return null;
                    const toolName = getToolName(part);

                    if (part.state === "output-available") {
                      return (
                        <div key={part.toolCallId} className="flex justify-start">
                          <Surface className="max-w-[92%] overflow-x-auto rounded-xl border-l-2 border-kumo-success px-4 py-3 shadow-sm ring-1 ring-kumo-line md:max-w-[80%]">
                            <div className="mb-1.5 flex items-center gap-2">
                              <GearIcon size={14} className="text-kumo-success" />
                              <Text size="xs" variant="secondary" bold className="uppercase tracking-wider">
                                {toolName}
                              </Text>
                              <Badge variant="secondary" className="text-[10px]">Complete</Badge>
                            </div>
                            <pre className="font-mono text-[11px] text-kumo-subtle md:text-xs">
                              {JSON.stringify(part.output, null, 2)}
                            </pre>
                          </Surface>
                        </div>
                      );
                    }

                    if ("approval" in part && part.state === "approval-requested") {
                      const approvalId = (part.approval as { id?: string })?.id;
                      return (
                        <div key={part.toolCallId} className="flex justify-start">
                          <Surface className="max-w-[92%] rounded-xl border-l-2 border-kumo-warning px-4 py-3 shadow-sm ring-1 ring-kumo-warning/50 md:max-w-[80%]">
                            <div className="mb-2 flex items-center gap-2">
                              <GearIcon size={14} className="text-kumo-warning" />
                              <Text size="sm" bold className="text-kumo-warning">
                                Execution Approval Required: {toolName}
                              </Text>
                            </div>
                            <div className="mb-4 overflow-x-auto rounded-md bg-kumo-recessed p-2">
                              <pre className="font-mono text-[11px] text-kumo-subtle md:text-xs">
                                {JSON.stringify(part.input, null, 2)}
                              </pre>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<CheckCircleIcon size={16} />}
                                onClick={() => {
                                  if (approvalId) {
                                    addToolApprovalResponse({ id: approvalId, approved: true });
                                  }
                                }}
                                className="flex-1 sm:flex-none"
                              >
                                Authorize
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<XCircleIcon size={16} />}
                                onClick={() => {
                                  if (approvalId) {
                                    addToolApprovalResponse({ id: approvalId, approved: false });
                                  }
                                }}
                                className="flex-1 sm:flex-none"
                              >
                                Deny
                              </Button>
                            </div>
                          </Surface>
                        </div>
                      );
                    }

                    if (part.state === "input-available" || part.state === "input-streaming") {
                      return (
                        <div key={part.toolCallId} className="flex justify-start">
                          <Surface className="max-w-[92%] rounded-xl border-l-2 border-kumo-info px-4 py-2.5 shadow-sm ring-1 ring-kumo-line md:max-w-[80%]">
                            <div className="flex items-center gap-2">
                              <GearIcon size={14} className="animate-spin text-kumo-info" />
                              <Text size="xs" variant="secondary" className="font-medium uppercase tracking-wider">
                                Executing {toolName}...
                              </Text>
                            </div>
                          </Surface>
                        </div>
                      );
                    }

                    return null;
                  })}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-kumo-base pb-4 pt-2 md:pb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mx-auto max-w-4xl px-4 py-3 md:px-6 md:py-4"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-kumo-line bg-kumo-recessed p-2 shadow-inner transition-colors focus-within:border-kumo-brand focus-within:bg-kumo-base md:gap-3 md:p-3">
            <InputArea
              value={input}
              onValueChange={setInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Interact with the edge..."
              disabled={!isConnected || isStreaming}
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none ring-0 focus:ring-0 md:text-base"
              style={{ minHeight: "44px", maxHeight: "150px" }}
            />
            <Button
              type="submit"
              variant="primary"
              shape="square"
              aria-label="Send transmission"
              disabled={!input.trim() || !isConnected || isStreaming}
              icon={<PaperPlaneRightIcon size={20} weight="fill" />}
              loading={isStreaming}
              className="h-11 w-11 shrink-0 rounded-xl"
            />
          </div>
          <div className="mt-2 text-center">
            <Text size="xs" variant="secondary" className="opacity-75">
              Powered by Cloudflare Workers AI & GLM-4.7-Flash
            </Text>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-kumo-elevated text-kumo-inactive">
          <div className="flex flex-col items-center gap-3">
            <div className="size-6 animate-spin rounded-full border-2 border-kumo-brand border-t-transparent" />
            <span className="text-sm font-medium tracking-wide">Initializing Edge Environment...</span>
          </div>
        </div>
      }
    >
      <Chat />
    </Suspense>
  );
}
