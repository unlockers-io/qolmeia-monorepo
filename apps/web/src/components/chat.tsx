"use client";

import type { FlueConversationMessage } from "@flue/sdk";
import { agentAvatarClass, agentInitials, agentRoleLabel } from "@repo/app-shell/agent-avatar";
import { AGENT_STATUS } from "@repo/app-shell/agent-status";
import { Marker, MarkerContent, MarkerIcon } from "@repo/ui/components/marker";
import { Message, MessageContent } from "@repo/ui/components/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@repo/ui/components/message-scroller";
import { AssetImage } from "@repo/ui/compositions/asset-image";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { LoadingSpinner } from "@repo/ui/compositions/loading-spinner";
import { MarkdownResponse } from "@repo/ui/compositions/markdown-response";
import { StatusPill } from "@repo/ui/compositions/status-pill";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { cn } from "@repo/ui/lib/utils";
import type { ConversationAgent, SkillId } from "@repo/worker-api/contracts";
import { ArrowDown, ImageIcon, Maximize2, MessageSquare, TriangleAlert } from "lucide-react";
import { Skeleton } from "skullet/react";

import { ChatComposer } from "@/components/chat-composer";
import type { UseFlueChatResult } from "@/lib/use-flue-chat";
import { useFlueChat } from "@/lib/use-flue-chat";

type ChatProps = {
  agent: ConversationAgent;
  companyId: string;
};

const PLANNER_GREETING =
  "Oi! Vou fazer algumas perguntas para conhecer seu negócio e montar o time certo para você. Para começar: o que sua empresa faz e quem ela atende?";

const TOOL_ACTIVITY_LABELS = {
  delegateToWorker: "Encaminhando para o time…",
  extractBrief: "Registrando o brief…",
  fetchUrl: "Lendo uma página…",
  listAssets: "Consultando a biblioteca…",
  proposeTeam: "Montando a proposta de time…",
  readAsset: "Lendo um documento…",
  recallMemory: "Consultando a memória…",
  rememberFact: "Anotando na memória…",
  saveAsset: "Salvando na biblioteca…",
  webSearch: "Pesquisando na web…",
} satisfies Partial<Record<SkillId, string>>;

const toolActivityLabelByName = new Map<string, string>(Object.entries(TOOL_ACTIVITY_LABELS));

const toolActivityLabel = (toolName: string): string =>
  toolActivityLabelByName.get(toolName) ?? "Trabalhando…";

const isChatMessage = (message: FlueConversationMessage): boolean => message.display === "visible";

const hasVisibleContent = (message: FlueConversationMessage): boolean =>
  message.parts.some(
    (part) =>
      part.type === "file" ||
      (part.type === "text" && part.text.length > 0) ||
      (part.type === "dynamic-tool" && part.state === "input-available"),
  );

const MessageBubble = ({ message }: { message: FlueConversationMessage }) => {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "w-fit min-w-0 rounded-2xl px-4 py-2 text-sm",
        isUser
          ? "ml-auto max-w-full rounded-br-sm bg-primary text-primary-foreground"
          : "max-w-prose rounded-bl-sm border border-border bg-card text-foreground",
      )}
    >
      {message.parts.map((part, index) => {
        const partKey = `${message.id}-${index}`;

        if (part.type === "text") {
          return <MarkdownResponse key={partKey}>{part.text}</MarkdownResponse>;
        }

        if (part.type === "dynamic-tool") {
          if (part.state !== "input-available") {
            return null;
          }

          return (
            <span
              className="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground"
              key={partKey}
            >
              <LoadingSpinner className="size-3" />
              {toolActivityLabel(part.toolName)}
            </span>
          );
        }

        if (part.type === "file" && part.mediaType.startsWith("image/")) {
          if (part.url === undefined || part.url === "") {
            return (
              <span
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  isUser ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
                key={partKey}
              >
                <ImageIcon aria-hidden className="size-3.5" />
                Imagem enviada
              </span>
            );
          }

          if (isUser) {
            return (
              <AssetImage
                alt={part.filename ?? "Imagem"}
                className="max-h-80 rounded-lg object-contain"
                height={800}
                key={partKey}
                src={part.url}
                width={800}
              />
            );
          }

          return (
            <figure className="flex flex-col gap-1.5" key={partKey}>
              <a
                className="block overflow-hidden rounded-lg transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                href={part.url}
                rel="noreferrer"
                target="_blank"
              >
                <AssetImage
                  alt={part.filename ?? "Entrega do time"}
                  className="max-h-80 w-full object-contain"
                  height={800}
                  src={part.url}
                  width={800}
                />
              </a>
              <figcaption className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Maximize2 aria-hidden className="size-3.5" />
                Entrega do seu time · abrir em tamanho real
              </figcaption>
            </figure>
          );
        }

        return null;
      })}
    </div>
  );
};

const AssistantAvatar = ({ agent }: { agent: ConversationAgent }) => (
  <div
    aria-hidden
    className={cn(
      "flex size-7 shrink-0 items-center justify-center self-end rounded-lg text-xs font-bold text-white",
      agentAvatarClass(agent, null),
    )}
  >
    {agentInitials(agentRoleLabel(agent, null))}
  </div>
);

const PlannerGreeting = ({ scrollAnchor }: { scrollAnchor: boolean }) => (
  <MessageScrollerItem messageId="planner-greeting" scrollAnchor={scrollAnchor}>
    <Message align="start">
      <AssistantAvatar agent="planner" />
      <MessageContent>
        <div className="w-fit max-w-prose min-w-0 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2 text-sm text-foreground">
          <MarkdownResponse>{PLANNER_GREETING}</MarkdownResponse>
        </div>
      </MessageContent>
    </Message>
  </MessageScrollerItem>
);

const ChatHeader = ({ agent, thinking }: { agent: ConversationAgent; thinking: boolean }) => {
  if (agent !== "correspondent") {
    return <h1 className="sr-only">Conversa com o Planejador</h1>;
  }

  const status = thinking
    ? { ...AGENT_STATUS.working, label: "Respondendo…" }
    : AGENT_STATUS.available;

  return (
    <header className="flex h-13.5 flex-none items-center gap-3 border-b border-border bg-card px-6">
      <span
        aria-hidden
        className={cn(
          "flex size-8 flex-none items-center justify-center rounded-lg text-(length:--text-label) font-bold text-white",
          agentAvatarClass(agent, null),
        )}
      >
        {agentInitials(agentRoleLabel(agent, null))}
      </span>
      <div className="min-w-0">
        <h1 className="font-display text-sm font-bold tracking-tight text-foreground">
          {agentRoleLabel(agent, null)}
        </h1>
        <p className="text-xs text-muted-foreground">Seu ponto de contato</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <StatusPill label={status.label} pulse={status.pulse} tone={status.tone} />
      </div>
    </header>
  );
};

const sampleMessage = (
  id: string,
  role: "assistant" | "user",
  text: string,
): FlueConversationMessage => ({
  display: "visible",
  id,
  parts: [{ state: "done", text, type: "text" }],
  purpose: role,
  role,
});

const SAMPLE_MESSAGES: ReadonlyArray<FlueConversationMessage> = [
  sampleMessage(
    "sample-1",
    "user",
    "Preciso de três posts para o lançamento do cardápio de verão.",
  ),
  sampleMessage(
    "sample-2",
    "assistant",
    "Combinado! Vou pedir ao Designer três artes no tom da marca e te aviso assim que estiverem prontas para aprovação.",
  ),
  sampleMessage("sample-3", "user", "Pode começar pelo post do açaí?"),
  sampleMessage(
    "sample-4",
    "assistant",
    "Claro. O post do açaí sai primeiro, e o Redator já está escrevendo a legenda.",
  ),
];

const ChatSkeleton = ({ agent }: Pick<ChatProps, "agent">) => (
  <div className="flex min-h-0 flex-1 flex-col bg-background">
    <ChatHeader agent={agent} thinking={false} />
    <div className="min-h-0 flex-1 overflow-hidden p-4">
      <Skeleton label="Carregando conversa" loading>
        <div className="flex flex-col gap-6">
          {SAMPLE_MESSAGES.map((message) => (
            <Message align={message.role === "user" ? "end" : "start"} key={message.id}>
              {message.role === "user" ? null : <AssistantAvatar agent={agent} />}
              <MessageContent>
                <MessageBubble message={message} />
              </MessageContent>
            </Message>
          ))}
        </div>
      </Skeleton>
    </div>
    <div className="flex-none border-t border-border bg-card px-6 py-4">
      <div className="h-16 rounded-xl border border-input bg-background" />
    </div>
  </div>
);

type ChatViewProps = Pick<ChatProps, "agent"> & {
  chat: UseFlueChatResult;
};

const ChatView = ({
  agent: agentName,
  chat: { historyReady, messages, sendMessage, status },
}: ChatViewProps) => {
  const visibleMessages = messages.filter(
    (message) => isChatMessage(message) && hasVisibleContent(message),
  );

  const showPlannerGreeting = agentName === "planner";

  const hasConversation = showPlannerGreeting || visibleMessages.length > 0;

  const isThinking = status === "submitted" || status === "streaming";
  const lastIndex = visibleMessages.length - 1;

  if (!historyReady) {
    return <ChatSkeleton agent={agentName} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <ChatHeader agent={agentName} thinking={isThinking} />

      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-label="Mensagens da conversa">
            <MessageScrollerContent className="p-4">
              {hasConversation ? (
                <>
                  <Marker variant="separator">
                    <MarkerContent>Início da conversa</MarkerContent>
                  </Marker>
                  {showPlannerGreeting ? (
                    <PlannerGreeting scrollAnchor={visibleMessages.length === 0} />
                  ) : null}
                  {visibleMessages.map((message, index) => (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={index === lastIndex}
                    >
                      <Message align={message.role === "user" ? "end" : "start"}>
                        {message.role === "user" ? null : <AssistantAvatar agent={agentName} />}
                        <MessageContent>
                          <MessageBubble message={message} />
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  ))}
                </>
              ) : (
                <EmptyState
                  className="size-full"
                  description="Os agentes da Qolmeia respondem em segundos."
                  icon={<MessageSquare aria-hidden />}
                  title="Comece a conversa"
                />
              )}

              {isThinking ? (
                <Marker className="pl-9">
                  <LoadingSpinner className="size-4" />
                  <MarkerContent>Um agente está respondendo…</MarkerContent>
                </Marker>
              ) : null}

              {status === "error" ? (
                <Marker className="pl-9">
                  <span className="contents text-destructive">
                    <MarkerIcon>
                      <TriangleAlert aria-hidden />
                    </MarkerIcon>
                    <MarkerContent>Não foi possível enviar. Tente novamente.</MarkerContent>
                  </span>
                </Marker>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton>
            <ArrowDown aria-hidden />
            <span className="sr-only">Ir para a mensagem mais recente</span>
          </MessageScrollerButton>
        </MessageScroller>
      </MessageScrollerProvider>

      <ChatComposer onSend={sendMessage} status={status} />
    </div>
  );
};

const ChatClient = ({ agent, companyId }: ChatProps) => {
  const chat = useFlueChat({ agent, companyId });

  return <ChatView agent={agent} chat={chat} />;
};

const Chat = (props: ChatProps) => {
  const ready = useClientReady();

  if (!ready) {
    return <ChatSkeleton agent={props.agent} />;
  }

  return <ChatClient {...props} />;
};

export { Chat, ChatSkeleton, ChatView, PLANNER_GREETING };

export type { ChatProps };
