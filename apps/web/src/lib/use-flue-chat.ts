"use client";

import { type AgentStatus, useFlueAgent, type UseFlueAgentResult } from "@flue/react";
import type { DeliveredAttachment, FlueConversationMessage } from "@flue/sdk";
import type { ConversationAgent } from "@repo/worker-api/contracts";
import type { ChatStatus, FileUIPart } from "ai";

type SendInput = {
  files: Array<FileUIPart>;
  text: string;
};

type UseFlueChatOptions = {
  agent: ConversationAgent;
  companyId: string;
};

type UseFlueChatResult = {
  historyReady: boolean;
  messages: Array<FlueConversationMessage>;
  sendMessage: (input: SendInput) => Promise<void>;
  status: ChatStatus;
};

type Conversation = Pick<
  UseFlueAgentResult,
  "historyReady" | "messages" | "sendMessage" | "status"
>;

type UseConversation = (url: string) => Conversation;

const STATUS_MAP = {
  connecting: "ready",
  error: "error",
  idle: "ready",
  streaming: "streaming",
  submitted: "submitted",
} as const satisfies Record<AgentStatus, ChatStatus>;

const BASE64_CHUNK = 0x80_00;

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
    binary += String.fromCodePoint(...bytes.subarray(index, index + BASE64_CHUNK));
  }

  return btoa(binary);
};

const toPromptImage = async ({ mediaType, url }: FileUIPart): Promise<DeliveredAttachment> => {
  const response = await fetch(url, { credentials: "include" });

  if (!response.ok) {
    throw new Error(`failed to read attachment (${response.status})`);
  }

  return { data: toBase64(await response.arrayBuffer()), mimeType: mediaType, type: "image" };
};

const useConversation: UseConversation = (url) => useFlueAgent({ url });

const createUseFlueChat = (useAgentConversation: UseConversation) => {
  const useFlueChatWithDependencies = ({
    agent,
    companyId,
  }: UseFlueChatOptions): UseFlueChatResult => {
    const conversation = useAgentConversation(`/agents/${agent}/${companyId}`);

    const sendMessage = async (input: SendInput) => {
      const text = input.text.trim();

      if (!text && input.files.length === 0) {
        return;
      }

      await conversation.sendMessage(text, {
        images: await Promise.all(input.files.map(toPromptImage)),
      });
    };

    return {
      historyReady: conversation.historyReady,
      messages: conversation.messages,
      sendMessage,
      status: STATUS_MAP[conversation.status],
    };
  };

  return useFlueChatWithDependencies;
};

const useFlueChat = createUseFlueChat(useConversation);

export { createUseFlueChat, useFlueChat };

export type { UseFlueChatResult };
