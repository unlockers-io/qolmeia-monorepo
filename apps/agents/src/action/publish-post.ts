import type { Prisma } from "@repo/db/worker";
import {
  POST_PLATFORM_NAMES,
  postDraftSchema,
  PROPOSED_SCHEMAS,
  type PostDraft,
  type ProposedOf,
  type SkillId,
} from "@repo/worker-api/contracts";

import type { ActionTypeModule } from "#/action/action-type";
import { readDeliverable } from "#/action/deliverable";
import { assetReference, promoteAssets } from "#/library/assets";

const DRAFT_SKILL: SkillId = "draftSocialPost";

const renderPost = (draft: PostDraft, imageUrls: ReadonlyArray<string>): string =>
  [
    `**Post para ${POST_PLATFORM_NAMES[draft.platform]}**`,
    draft.body,
    draft.callToAction,
    (draft.hashtags ?? []).map((tag) => `#${tag}`).join(" "),
    ...imageUrls.map((url) => `![](${url})`),
  ]
    .filter((part) => part !== "")
    .join("\n\n");

const imageReferences = (
  assets: ReadonlyArray<{ id: string; mime: string }>,
): ReadonlyArray<string> =>
  assets.flatMap(({ id, mime }) => (mime.startsWith("image/") ? [assetReference(id)] : []));

const read = (proposed: Prisma.JsonValue): ProposedOf<"publish_post"> =>
  PROPOSED_SCHEMAS.publish_post.parse(proposed);

const publishPost: ActionTypeModule<"publish_post"> = {
  defaultPolicy: "require_approval",
  async execute({ companyId, db }, proposed) {
    const { assetIds, draft, summary } = read(proposed);
    const assets = await promoteAssets(db, companyId, assetIds);

    return draft === undefined ? summary : renderPost(draft, imageReferences(assets));
  },
  propose(generation) {
    const deliverable = readDeliverable(generation);
    const output = generation.outputs.findLast(({ tool }) => tool === DRAFT_SKILL);
    const draft = postDraftSchema.safeParse(output === undefined ? null : JSON.parse(output.json));

    return draft.success ? { ...deliverable, draft: draft.data } : deliverable;
  },
  read,
};

export { publishPost };
