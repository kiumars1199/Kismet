// AI crawlers (docs/14 §6, docs/15 § Bots): disallowed in robots.txt and refused (403) by middleware, since
// a crawler may ignore robots.txt. Edge-safe (middleware imports it).
export const AI_BOTS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "Claude-User", "Claude-SearchBot", "anthropic-ai",
  "CCBot", "PerplexityBot", "Perplexity-User", "Google-Extended", "GoogleOther", "Applebot-Extended", "Bytespider",
  "Amazonbot", "meta-externalagent", "meta-externalfetcher", "FacebookBot", "cohere-ai", "cohere-training-data-crawler",
  "Diffbot", "ImagesiftBot", "Omgilibot", "Omgili", "Timpibot", "YouBot", "AI2Bot", "Ai2Bot-Dolma",
  "DuckAssistBot", "MistralAI-User", "Scrapy", "img2dataset", "Kangaroo Bot", "PanguBot", "SemrushBot-OCOB", "Webzio-Extended",
];

const RE = new RegExp(AI_BOTS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

/** True for a known AI-crawler user agent. */
export const isAiBot = (ua: string | null | undefined) => !!ua && RE.test(ua);
