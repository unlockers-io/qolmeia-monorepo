import { dispatch } from "@flue/runtime";

import { CorrespondentV2 } from "#/agents/correspondent";

type CorrespondentSignal = { body: string; idempotencyKey: string; type: string };

/** Internal prompts are signals: Flue marks them diagnostic, which keeps them out of the customer's transcript. */
const signalCorrespondent = (
  companyId: string,
  { body, idempotencyKey, type }: CorrespondentSignal,
  send: typeof dispatch = dispatch,
) =>
  send(CorrespondentV2, { id: companyId, idempotencyKey, message: { body, kind: "signal", type } });

export { signalCorrespondent };
