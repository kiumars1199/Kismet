import { defineConfig } from "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/apps/web/node_modules/vitest/dist/config.js";
export default defineConfig({
  resolve: { alias: { "@": "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/apps/web", "server-only": "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/apps/web/test/server-only.ts" } },
  test: { root: "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/docs/launch/review/f60/run", environment: "node", include: ["*.timing.test.ts"], testTimeout: 300000, env: { DATA_SOURCE: "local", DATA_CLOCK: "scan" } },
});
