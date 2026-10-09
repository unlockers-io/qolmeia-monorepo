type ActionProposedEvent = {
  payload: { actionId: string; summary: string };
  refId: string;
  refType: "action";
  type: "ACTION_PROPOSED";
};

type ActionApprovedEvent = {
  payload: { feedback: string | null };
  refId: string;
  refType: "action";
  type: "ACTION_APPROVED";
};

type ActionExecutedEvent = {
  payload?: undefined;
  refId: string;
  refType: "action";
  type: "ACTION_EXECUTED";
};

type ActionRejectedEvent = {
  payload: { feedback: string | null };
  refId: string;
  refType: "action";
  type: "ACTION_REJECTED";
};

type ActionChangesRequestedEvent = {
  payload: { feedback: string | null };
  refId: string;
  refType: "action";
  type: "ACTION_CHANGES_REQUESTED";
};

type ActionRevisedEvent = {
  payload: { feedback: string | null; revision: number };
  refId: string;
  refType: "action";
  type: "ACTION_REVISED";
};

type ActionNotifyEvent = {
  payload: { summary: string };
  refId: string;
  refType: "action";
  type: "ACTION_NOTIFY";
};

type TeamConfirmedEvent = {
  payload: {
    correspondentId: string;
    teamId: string;
    templateIds: ReadonlyArray<string>;
    workerIds: ReadonlyArray<string>;
  };
  refId: string;
  refType: "team";
  type: "TEAM_CONFIRMED";
};

type MemberHiredEvent = {
  payload: { displayName: string; templateId: string };
  refId: string;
  refType: "agent_instance";
  type: "MEMBER_HIRED";
};

type MemberPausedEvent = {
  payload?: undefined;
  refId: string;
  refType: "agent_instance";
  type: "MEMBER_PAUSED";
};

type MemberResumedEvent = {
  payload?: undefined;
  refId: string;
  refType: "agent_instance";
  type: "MEMBER_RESUMED";
};

type MemberRenamedEvent = {
  payload: { newName: string; oldName: string };
  refId: string;
  refType: "agent_instance";
  type: "MEMBER_RENAMED";
};

type MemberPromptEditedEvent = {
  payload: { editedBy: "customer" | "operator"; length: number };
  refId: string;
  refType: "agent_instance";
  type: "MEMBER_PROMPT_EDITED";
};

type MemberPromptResetEvent = {
  payload: { editedBy: "customer" | "operator" };
  refId: string;
  refType: "agent_instance";
  type: "MEMBER_PROMPT_RESET";
};

type WorkerProactiveSuggestionEvent = {
  payload?: undefined;
  refId: string;
  refType: "agent_instance";
  type: "WORKER_PROACTIVE_SUGGESTION";
};

type ActivityEvent =
  | ActionProposedEvent
  | ActionApprovedEvent
  | ActionExecutedEvent
  | ActionRejectedEvent
  | ActionChangesRequestedEvent
  | ActionRevisedEvent
  | ActionNotifyEvent
  | TeamConfirmedEvent
  | MemberHiredEvent
  | MemberPausedEvent
  | MemberResumedEvent
  | MemberRenamedEvent
  | MemberPromptEditedEvent
  | MemberPromptResetEvent
  | WorkerProactiveSuggestionEvent;

export type { ActivityEvent };
