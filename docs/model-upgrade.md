# Model upgrade — 29 September 2026

These defaults were checked against the live provider documentation and
[OpenRouter catalog](https://openrouter.ai/api/v1/models).

| Workload                               | Previous default                        | New default                     |
| -------------------------------------- | --------------------------------------- | ------------------------------- |
| Correspondent and Planner              | `anthropic/claude-sonnet-4.5`           | `anthropic/claude-sonnet-5.5`   |
| Designer tool orchestration            | `openai/gpt-5.4-nano`                   | `openai/gpt-6-luna`             |
| Marketing, writing and SEO specialists | `openai/gpt-5.4-mini`                   | `openai/gpt-6.1-sol`            |
| Brand image generation and editing     | `google/gemini-3.1-flash-image-preview` | `google/gemini-3.1-flash-image` |
| Semantic memory                        | `@cf/baai/bge-m3`                       | `@cf/qwen/qwen3-embedding-0.6b` |

The Designer keeps an economical orchestration model; writing and research use
the current workhorse tier. Sol costs more than the previous mini default.
The image model is the stable successor with reference-image and editing support;
Flash Lite Image targets cheaper, simpler generation.

Flue explicitly registers Sonnet 5.5 with image input, its context window and
pricing because the bundled Pi catalog predates the release. Existing OpenRouter
models remain available. The Correspondent and Planner both use
`CONVERSATION_MODEL` with low reasoning effort. A live local customer chat
completed successfully with Sonnet 5.5.

GPT-6 specialists use OpenRouter's Responses endpoint through Cloudflare AI
Gateway, with low reasoning effort and `store: false`. Each step
replays tool results and encrypted reasoning. Other configured models keep the
existing Chat Completions transport. No temperature or sampling overrides are
sent. Both GPT-6 defaults completed a live two-step function-call/result/final-text
check through the gateway. These smoke checks verify transport, not creative
quality or production account quotas.

The catalog seed upgrades only the four built-in templates when their model
still matches the shipped 5.4 default. It preserves custom models, prompts,
policies, names and skills. Both database entry points use the same seed routine.

## Model wiring

`apps/agents/src/lib/models.ts` is the only place model ids, provider quirks and
gateway credentials appear. It supplies the Flue provider, the Workflow's
`generateText` model, and the image-generation request, and routes all three
through Cloudflare AI Gateway (`AI_GATEWAY_ACCOUNT_ID`, `AI_GATEWAY_NAME`) with
`OPENROUTER_API_KEY` as the bearer token. There are no model env vars.

- **Conversation model** (Correspondent and Planner): change `CONVERSATION`, with
  the id and the context window, output limit and pricing from the
  OpenRouter catalog.
- **Image model**: change `IMAGE_MODEL`. It must accept
  `modalities: ["image", "text"]` on `/chat/completions`.
- **Specialist models**: set `model` on the template in the backoffice. Ids
  matching `RESPONSES_API_MODEL` (`openai/gpt-6*`) use the Responses endpoint;
  every other id uses Chat Completions.

## Deployment prerequisites

**Deploy the API before the Worker. Do not seed the new template models until
the new Worker is deployed.** The old Worker uses Chat Completions for every
specialist model and cannot safely run the new GPT-6 defaults with reasoning.

Memory needs a separate index even though both models produce 1024 dimensions:
BGE and Qwen vectors cannot be compared. The old `qolmeia-memory` index is retained.
No production resources are changed by this PR or by the test suite.

1. Deploy the API. Pause customer AI requests and drain in-flight Worker jobs
   for the memory cutover; no memory writes or deletions should occur during the
   final backfill. Leave this pause in place until verification completes.
2. From `apps/agents`, provision the new index and its tenant filter **before**
   inserting vectors:

   ```bash
   pnpm exec wrangler vectorize create qolmeia-memory-qwen3 --dimensions=1024 --metric=cosine
   pnpm exec wrangler vectorize create-metadata-index qolmeia-memory-qwen3 --property-name=agentInstanceId --type=string
   ```

3. Set `DATABASE_URL` to the production Postgres connection and
   `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` in the operator's environment.
   The token needs Workers AI access and Vectorize edit access. From the repo root:

   ```bash
   pnpm --filter=worker-bees memory:reindex
   ```

   The script reads `memory_fact`, validates the new index's name/dimensions/metric,
   embeds every record, and upserts it with the original ID and tenant metadata.
   It writes only to `qolmeia-memory-qwen3`, never the old index or Postgres.
   It fails on API errors or malformed vectors. Rerunning is safe: IDs are stable.
   Logs contain counts and mutation IDs, not memory contents or credentials.

4. Wait for indexing: run `pnpm exec wrangler vectorize info qolmeia-memory-qwen3`
   from `apps/agents`. Verify the processed mutation has reached the last logged
   mutation and the vector count matches the script's total. Do not switch to an
   empty or partially indexed index.
5. Deploy the Worker, which binds `VECTORIZE` to `qolmeia-memory-qwen3`. Run
   `pnpm --filter=@repo/db db:seed` against the production database, then deploy
   the Next apps.
6. Verify recall of an existing fact, isolation from another agent, a newly
   remembered fact, specialist tool use and an image delivery. Resume AI traffic.

Before resuming traffic, rollback can restore the prior Worker/index and the
previous template model values. After new facts have been written, re-embed those
facts with the old model before reverting its index; retaining the old index alone
does not copy newer memory. Do not delete either index during the rollout.

## Sources

- [Claude models](https://platform.claude.com/docs/en/about-claude/models/overview)
- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
- [OpenRouter stateless Responses API](https://openrouter.ai/docs/api_reference/responses/overview)
- [Google image model selection](https://ai.google.dev/gemini-api/docs/image-generation)
- [Cloudflare Qwen3 embedding](https://developers.cloudflare.com/workers-ai/models/qwen3-embedding-0.6b/)
