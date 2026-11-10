import { postDraftSchema } from "@repo/worker-api/contracts";

import { defineSkill } from "#/skills/skill";

const draftSocialPostSkill = defineSkill({
  description:
    "Rascunha um post para redes sociais (Instagram, Facebook, LinkedIn, Twitter). Use quando o cliente pedir um post, conteúdo de feed/stories, ou copy de publicação.",
  displayName: "Rascunhar post social",
  execute: (draft) => Promise.resolve(draft),
  id: "draftSocialPost",
  inputSchema: postDraftSchema,
});

export { draftSocialPostSkill };
