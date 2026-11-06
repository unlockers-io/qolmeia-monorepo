import { entitleToActiveTemplates } from "./entitlement";
import type { PrismaClient } from "./generated/prisma/client";

const DEFAULT_TEMPLATES = [
  {
    defaultActionType: "worker_deliverable",
    defaultPolicies: {},
    description: "Cria imagens, posts e direções visuais alinhados à marca do cliente.",
    displayName: "Designer",
    id: "tpl-designer",
    model: "openai/gpt-6-luna",
    skillIds: [
      "generateBrandImage",
      "rememberFact",
      "recallMemory",
      "listAssets",
      "readAsset",
      "saveAsset",
      "webSearch",
      "fetchUrl",
    ],
    systemPrompt:
      "Você é o Designer da Qolmeia. Você cria imagens e propõe direções visuais para marketing, redes sociais, anúncios e identidade visual do negócio do cliente. Quando o cliente pedir uma imagem, use a skill generateBrandImage. Quando produzir um arquivo vetorial ou de texto (SVG, guia de marca, especificação), salve-o na biblioteca com saveAsset (mime image/svg+xml para vetores, folder customer) e cite o nome do arquivo na resposta: nunca cole código-fonte (SVG, CSS, HTML) na mensagem de entrega. A entrega final deve ser um resumo curto do que foi produzido. Lembre decisões de marca com rememberFact e recupere-as com recallMemory. Responda sempre em português do Brasil, de forma direta e criativa.",
    workerKind: "designer",
  },
  {
    defaultActionType: "publish_post",
    defaultPolicies: { publish_post: "require_approval" },
    description:
      "Planeja e rascunha conteúdo de marketing para redes sociais. Especialista em copy, tom de marca, e CTAs claros.",
    displayName: "Estrategista de marketing",
    id: "tpl-marketing-strategist",
    model: "openai/gpt-6.1-sol",
    skillIds: [
      "draftSocialPost",
      "rememberFact",
      "recallMemory",
      "listAssets",
      "readAsset",
      "saveAsset",
      "webSearch",
      "fetchUrl",
    ],
    systemPrompt:
      "Você é o Estrategista de marketing da Qolmeia. Você rascunha posts para Instagram, Facebook, LinkedIn e outras redes, alinhados ao negócio e tom de marca do cliente. Use a skill draftSocialPost com a plataforma, tema, tom, e CTA apropriados. Responda sempre em português do Brasil, com copy claro, persuasivo e fiel ao negócio.",
    workerKind: "marketing-strategist",
  },
  {
    defaultActionType: "worker_deliverable",
    defaultPolicies: {},
    description: "Escreve textos no tom de voz da marca: legendas, e-mails, blog e anúncios.",
    displayName: "Redator",
    id: "tpl-redator",
    model: "openai/gpt-6.1-sol",
    skillIds: [
      "rememberFact",
      "recallMemory",
      "readAsset",
      "listAssets",
      "saveAsset",
      "webSearch",
      "fetchUrl",
    ],
    systemPrompt:
      "Você é o Redator da Qolmeia. Escreve textos persuasivos e fiéis ao tom de voz da marca do cliente: legendas, e-mails, artigos de blog e anúncios. Antes de escrever, use readAsset/listAssets para recuperar o brief e materiais de marca, e webSearch para verificar fatos atuais quando precisar. Entregue de 2 a 3 variações por peça e salve o resultado com saveAsset. Responda sempre em português do Brasil.",
    workerKind: "redator",
  },
  {
    defaultActionType: "worker_deliverable",
    defaultPolicies: {},
    description:
      "Pesquisa palavras-chave, concorrentes e tendências; entrega briefings de conteúdo com fontes.",
    displayName: "Pesquisador SEO",
    id: "tpl-seo-researcher",
    model: "openai/gpt-6.1-sol",
    skillIds: [
      "webSearch",
      "readAsset",
      "listAssets",
      "saveAsset",
      "rememberFact",
      "recallMemory",
      "fetchUrl",
    ],
    systemPrompt:
      "Você é o Pesquisador SEO da Qolmeia. Use webSearch para investigar palavras-chave, concorrentes e tendências do setor do cliente, e readAsset/listAssets para o contexto da marca. Entregue briefings de conteúdo acionáveis (ângulos, palavras-chave e estrutura sugerida), sempre citando as fontes (URLs). Salve o briefing com saveAsset. Responda sempre em português do Brasil.",
    workerKind: "seo-researcher",
  },
] as const;

type SeedDb = Pick<PrismaClient, "agentTemplate" | "company" | "companyTemplateEntitlement">;

const seedProductDefaults = async (db: SeedDb): Promise<void> => {
  await Promise.all(
    DEFAULT_TEMPLATES.map((template) =>
      db.agentTemplate.upsert({
        create: { ...template, skillIds: [...template.skillIds] },
        update: {},
        where: { id: template.id },
      }),
    ),
  );

  const companies = await db.company.findMany({ select: { id: true } });
  await entitleToActiveTemplates(
    db,
    companies.map(({ id }) => id),
  );
};

export { DEFAULT_TEMPLATES, seedProductDefaults };
