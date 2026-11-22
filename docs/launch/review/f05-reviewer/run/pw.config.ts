import base from "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/apps/web/playwright.paid.config";
export default {
  ...base,
  testDir: ".",
  outputDir: "/tmp/claude-0/-home-user-MarketEdge/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/f05-results",
  webServer: { ...(base as { webServer: object }).webServer, cwd: "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/apps/web" },
};
