import type { z } from "zod";

import type { ActionTypeModule } from "#/action/action-type";
import { deliverableSchema, readDeliverable, releaseDeliverable } from "#/action/deliverable";
import { assetReference } from "#/library/assets";
import { draftSocialPostInputSchema, draftSocialPostSkill } from "#/skills/draft-social-post";

type PostDraft = z.infer<typeof draftSocialPostInputSchema>;

const publishPostSchema = deliverableSchema.extend({
  draft: draftSocialPostInputSchema.optional(),
});

const PLATFORM_NAMES = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
} satisfies Record<PostDraft["platform"], string>;

const renderPost = (draft: PostDraft, imageUrls: ReadonlyArray<string>): string =>
  [
    `**Post para ${PLATFORM_NAMES[draft.platform]}**`,
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

const publishPost: ActionTypeModule = {
  defaultPolicy: "require_approval",
  async execute(ctx, proposed) {
    const { assetIds, draft, summary } = publishPostSchema.parse(proposed);
    const assets = await releaseDeliverable(ctx, assetIds);
    return draft === undefined ? summary : renderPost(draft, imageReferences(assets));
  },
  propose(generation) {
    const deliverable = readDeliverable(generation);
    const output = generation.outputs.findLast(({ tool }) => tool === draftSocialPostSkill.id);
    const draft = draftSocialPostInputSchema.safeParse(
      output === undefined ? null : JSON.parse(output.json),
    );
    return draft.success ? { ...deliverable, draft: draft.data } : deliverable;
  },
};

export { publishPost };
