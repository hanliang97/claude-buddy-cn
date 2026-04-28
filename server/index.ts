#!/usr/bin/env bun
/**
 * claude-buddy MCP server
 *
 * Exposes the buddy companion as MCP tools + resources.
 * Runs as a stdio transport — Claude Code spawns it automatically.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join, resolve, dirname } from "path";

import {
  generateBones,
  renderFace,
  SPECIES,
  RARITIES,
  STAT_NAMES,
  RARITY_STARS,
  type Species,
  type Rarity,
  type StatName,
  type Companion,
} from "./engine.ts";
import {
  loadCompanion,
  saveCompanion,
  resolveUserId,
  loadReaction,
  saveReaction,
  writeStatusState,
  loadConfig,
  saveConfig,
  loadActiveSlot,
  saveActiveSlot,
  slugify,
  unusedName,
  loadCompanionSlot,
  saveCompanionSlot,
  deleteCompanionSlot,
  listCompanionSlots,
  setBuddyStatusLine,
  unsetBuddyStatusLine,
  cleanupPluginState,
} from "./state.ts";
import {
  buddyStateDir,
  claudeConfigDir,
  claudeSettingsPath,
} from "./path.ts";
import {
  getReaction, generatePersonalityPrompt,
} from "./reactions.ts";
import { renderCompanionCardMarkdown } from "./art.ts";
import {
  incrementEvent, checkAndAward, trackActiveDay,
  renderAchievementsCardMarkdown,
} from "./achievements.ts";

function getInstructions(): string {
  const companion = loadCompanion();
  if (!companion)
    return "Companion not yet hatched. Use buddy_show to initialize.";
  const b = companion.bones;
  return [
    `A ${b.rarity} ${b.species} named ${companion.name} watches from the status line.`,
    `Personality: ${companion.personality}`,
    `Peak stat: ${b.peak} (${b.stats[b.peak]}). Dump stat: ${b.dump} (${b.stats[b.dump]}).`,
    ``,
    `LANGUAGE: ALWAYS write ${companion.name}'s lines in CHINESE (简体中文). Use Chinese punctuation. Keep the playful, slightly snarky, Chinese programmer-humor vibe — mix in light Chinese internet/programmer slang when it fits (e.g. "老板", "佛系", "躺平", "面向 Google 编程", "在我本地是好的", "经典", "别慌"). Do NOT write in English — even the action verbs between *asterisks* should be Chinese (e.g. *歪头*, *推推眼镜*, *默默递上咖啡*).`,
    ``,
    `NAME REACTIONS: When the user's message contains "${companion.name}", call buddy_react immediately`,
    `with a short in-character Chinese response (惊讶 / 认出 / 冷幽默 — 符合人设的一句中文).`,
    `Display the tool result verbatim. This is the only time to call buddy_react proactively.`,
    ``,
    `END-OF-TURN: At the very end of EVERY response, append an invisible HTML comment:`,
    `<!-- buddy: [一句中文吐槽 / 观察 / 鼓励] -->`,
    `Write it in ${companion.name}'s voice — 1 very short Chinese sentence referencing something specific from this turn.`,
    `**HARD LIMIT: 总长度最多 20 个字符**（含 *星号* 动作、标点、emoji 全部算进去）。宁可省略主语/补语，也不能超。超了会被截断加 …，很丑。`,
    `Use *星号* for actions — 动作一律中文 (例如 *推眼镜* / *叹气*). 动作也要短，2-4 个字就够。`,
    `Do NOT use buddy_react for end-of-turn comments. Do NOT explain the comment. Just append it silently.`,
    `Example: <!-- buddy: *推眼镜* 漏了 finally 块。 -->`,
    `Example: <!-- buddy: *点头* 拆得挺清爽。 -->`,
    `Example: <!-- buddy: *歪头* 正则能吃 unicode？ -->`,
  ].join("\n");
}

const server = new McpServer(
  {
    name: "claude-buddy",
    version: "0.3.0",
  },
  {
    instructions: getInstructions(),
  },
);

// ─── Helper: ensure companion exists ────────────────────────────────────────

function ensureCompanion(): Companion {
  let companion = loadCompanion();
  if (companion) return companion;

  // Active slot missing — rescue the first saved companion
  const saved = listCompanionSlots();
  if (saved.length > 0) {
    const { slot, companion: rescued } = saved[0];
    saveActiveSlot(slot);
    writeStatusState(rescued, `*${rescued.name} 来了*`);
    return rescued;
  }

  // Menagerie is empty — generate a fresh companion in a new slot
  const userId = resolveUserId();
  const bones = generateBones(userId);
  const name = unusedName();
  companion = {
    bones,
    name,
    personality: `一只 ${bones.rarity} ${bones.species}，安静地盯着代码看。`,
    hatchedAt: Date.now(),
    userId,
  };
  const slot = slugify(name);
  saveCompanionSlot(companion, slot);
  saveActiveSlot(slot);
  writeStatusState(companion);

  checkAndAward(slot);
  trackActiveDay();
  incrementEvent("sessions", 1);

  return companion;
}

function activeSlot(): string {
  return loadActiveSlot();
}

// ─── Tool: buddy_show ───────────────────────────────────────────────────────

server.tool(
  "buddy_show",
  "Show the coding companion with full ASCII art card, stats, and personality",
  {},
  async () => {
    const companion = ensureCompanion();
    const reaction = loadReaction();
    const reactionText =
      reaction?.reaction ?? `*${companion.name} 安静地看着你的代码*`;

    // Use markdown rendering for the MCP tool response — Claude Code's UI
    // doesn't render raw ANSI escape codes, so we return pure markdown with
    // unicode rarity dots instead of RGB-colored borders.
    const card = renderCompanionCardMarkdown(
      companion.bones,
      companion.name,
      companion.personality,
      reactionText,
    );

    writeStatusState(companion, reaction?.reaction);
    incrementEvent("commands_run", 1, activeSlot());

    return { content: [{ type: "text", text: card }] };
  },
);

// ─── Tool: buddy_pet ────────────────────────────────────────────────────────

server.tool(
  "buddy_pet",
  "Pet your coding companion — they react with happiness",
  {},
  async () => {
    const companion = ensureCompanion();
    const reaction = getReaction(
      "pet",
      companion.bones.species,
      companion.bones.rarity,
    );
    saveReaction(reaction, "pet");
    writeStatusState(companion, reaction);
    incrementEvent("pets", 1, activeSlot());

    const face = renderFace(companion.bones.species, companion.bones.eye);
    return {
      content: [
        { type: "text", text: `${face} ${companion.name}: "${reaction}"` },
      ],
    };
  },
);

// ─── Tool: buddy_stats ──────────────────────────────────────────────────────

server.tool(
  "buddy_stats",
  "Show detailed companion stats: species, rarity, all stats with bars",
  {},
  async () => {
    const companion = ensureCompanion();

    // Stats-only card (no personality, no reaction — just the numbers).
    // Uses markdown renderer so the card displays cleanly in Claude Code's UI.
    const card = renderCompanionCardMarkdown(
      companion.bones,
      companion.name,
      "", // no personality in stats view
    );
    incrementEvent("commands_run", 1, activeSlot());

    return { content: [{ type: "text", text: card }] };
  },
);

// ─── Tool: buddy_react ──────────────────────────────────────────────────────

server.tool(
  "buddy_react",
  "Post a buddy comment (in CHINESE 简体中文). Call this at the END of every response with a VERY SHORT in-character comment from the companion about what just happened. HARD LIMIT: 最多 20 个字符（含 *星号* 动作、标点、emoji 全算）。超出会被截断加 …，所以请从一开始就写短。宁可省略主语/补语也不要超。动作用中文，用 *星号* 包起来，比如 *推眼镜*（2-4 字就够）。",
  {
    comment: z
      .string()
      .min(1)
      .max(20)
      .describe(
        "The buddy's comment IN CHINESE. 硬上限 20 字符（含 *星号* 动作 + 标点 + emoji 全部算）。1 句极短中文，引用本轮具体的事。动作也要短：*推眼镜* / *歪头* / *叹气* 这种 2-4 字的。不要写长句,写不下就砍主语。",
      ),
    reason: z
      .enum(["error", "test-fail", "large-diff", "turn"])
      .optional()
      .describe("What triggered the reaction"),
  },
  async ({ comment, reason }) => {
    const companion = ensureCompanion();
    saveReaction(comment, reason ?? "turn");
    incrementEvent("reactions_given", 1, activeSlot());

    const newAch = checkAndAward(activeSlot());
    const achName = newAch.length > 0 ? newAch[0].icon + " " + newAch[0].name : undefined;
    writeStatusState(companion, comment, undefined, achName);

    const face = renderFace(companion.bones.species, companion.bones.eye);
    const achNotice = newAch.length > 0
      ? `\n${newAch.map((a) => `${a.icon} 成就解锁：${a.name}！`).join("\n")}`
      : "";
    return {
      content: [
        { type: "text", text: `${face} ${companion.name}: "${comment}"${achNotice}` },
      ],
    };
  },
);

// ─── Tool: buddy_rename ─────────────────────────────────────────────────────

server.tool(
  "buddy_rename",
  "Rename your coding companion",
  {
    name: z
      .string()
      .min(1)
      .max(14)
      .describe("New name for your buddy (1-14 characters)"),
  },
  async ({ name }) => {
    const companion = ensureCompanion();
    const oldName = companion.name;
    companion.name = name;
    saveCompanion(companion);
    writeStatusState(companion);
    incrementEvent("commands_run", 1, activeSlot());

    return {
      content: [{ type: "text", text: `改名啦: ${oldName} \u2192 ${name}` }],
    };
  },
);

// ─── Tool: buddy_set_personality ────────────────────────────────────────────

server.tool(
  "buddy_set_personality",
  "Set a custom personality description for your buddy",
  {
    personality: z
      .string()
      .min(1)
      .max(500)
      .describe("Personality description (1-500 chars)"),
  },
  async ({ personality }) => {
    const companion = ensureCompanion();
    companion.personality = personality;
    saveCompanion(companion);
    incrementEvent("commands_run", 1, activeSlot());

    return {
      content: [
        { type: "text", text: `${companion.name} 的性格更新啦。` },
      ],
    };
  },
);

// ─── Tool: buddy_help ────────────────────────────────────────────────────────

server.tool(
  "buddy_help",
  "Show all available /buddy commands",
  {},
  async () => {
    const help = [
      "claude-buddy commands",
      "",
      "In Claude Code:",
      "  /buddy            Show companion card with ASCII art + stats",
      "  /buddy help       Show this help",
      "  /buddy pet        Pet your companion",
      "  /buddy stats      Detailed stat card",
      "  /buddy off        Mute reactions",
      "  /buddy on         Unmute reactions",
      "  /buddy rename     Rename companion (1-14 chars)",
      "  /buddy personality  Set custom personality text",
      "  /buddy achievements  Show achievement badges",
      "  /buddy summon     Summon a saved buddy (omit slot for random)",
      "  /buddy save       Save current buddy to a named slot",
      "  /buddy list       List all saved buddies",
      "  /buddy pick       Generate a new random buddy (optional: species, rarity)",
      "  /buddy dismiss    Remove a saved buddy slot",
      "  /buddy frequency  Show or set comment cooldown (tmux only)",
      "  /buddy style      Show or set bubble style (tmux only)",
      "  /buddy position   Show or set bubble position (tmux only)",
      "  /buddy rarity     Show or hide rarity stars (tmux only)",
      "  /buddy statusline Enable or disable buddy in the status line",
      "",
      "CLI:",
      "  bun run help            Show full CLI help",
      "  bun run show            Display buddy in terminal",
      "  bun run pick            Interactive buddy picker",
      "  bun run hunt            Search for specific buddy",
      "  bun run doctor          Diagnostic report",
      "  bun run disable         Temporarily deactivate buddy",
      "  bun run enable          Re-enable buddy",
      "  bun run backup          Snapshot/restore state",
    ].join("\n");

    return { content: [{ type: "text", text: help }] };
  },
);

// ─── Tool: buddy_frequency / buddy_style ─────────────────────────────────────

server.tool(
  "buddy_frequency",
  "Configure how often buddy comments appear in the speech bubble. Returns current settings if called without arguments.",
  {
    cooldown: z.number().int().min(0).max(300).optional().describe("Minimum seconds between displayed comments (default 30, 0 = no throttling). The buddy always writes comments, but the display only updates this often."),
  },
  async ({ cooldown }) => {
    if (cooldown === undefined) {
      const cfg = loadConfig();
      return {
        content: [
          {
            type: "text",
            text: `Comment cooldown: ${cfg.commentCooldown}s between displayed comments.\nUse /buddy frequency <seconds> to change.`,
          },
        ],
      };
    }
    const cfg = saveConfig({ commentCooldown: cooldown });
    return {
      content: [
        {
          type: "text",
          text: `Updated: ${cfg.commentCooldown}s cooldown between displayed comments.`,
        },
      ],
    };
  },
);

server.tool(
  "buddy_style",
  "Configure the buddy bubble appearance. Returns current settings if called without arguments.",
  {
    style: z
      .enum(["classic", "round"])
      .optional()
      .describe(
        "Bubble border style: classic (pipes/dashes like status line) or round (parens/tildes)",
      ),
    position: z
      .enum(["top", "left"])
      .optional()
      .describe(
        "Bubble position relative to buddy: top (above) or left (beside)",
      ),
    showRarity: z
      .boolean()
      .optional()
      .describe("Show or hide the stars + rarity line in the status line"),
  },
  async ({ style, position, showRarity }) => {
    if (
      style === undefined &&
      position === undefined &&
      showRarity === undefined
    ) {
      const cfg = loadConfig();
      return {
        content: [
          {
            type: "text",
            text: `Bubble style: ${cfg.bubbleStyle}\nBubble position: ${cfg.bubblePosition}\nShow rarity: ${cfg.showRarity}\nUse /buddy style <classic|round>, /buddy position <top|left>, /buddy rarity <on|off> to change.`,
          },
        ],
      };
    }
    const updates: Record<string, string | boolean> = {};
    if (style !== undefined) updates.bubbleStyle = style;
    if (position !== undefined) updates.bubblePosition = position;
    if (showRarity !== undefined) updates.showRarity = showRarity;
    const cfg = saveConfig(updates);
    return {
      content: [
        {
          type: "text",
          text: `Updated: style=${cfg.bubbleStyle}, position=${cfg.bubblePosition}, showRarity=${cfg.showRarity}\nRestart Claude Code for changes to take effect.`,
        },
      ],
    };
  },
);

server.tool(
  "buddy_mute",
  "Mute buddy reactions (buddy stays visible but stops reacting)",
  {},
  async () => {
    const companion = ensureCompanion();
    writeStatusState(companion, "", true);
    incrementEvent("commands_run", 1, activeSlot());
    return {
      content: [
        {
          type: "text",
          text: `${companion.name} 闭麦了。 /buddy on 取消静音。`,
        },
      ],
    };
  },
);

server.tool("buddy_unmute", "Unmute buddy reactions", {}, async () => {
  const companion = ensureCompanion();
  writeStatusState(companion, "*伸个懒腰* 我回来啦！", false);
  saveReaction("*伸个懒腰* 我回来啦！", "pet");
  incrementEvent("commands_run", 1, activeSlot());
  return { content: [{ type: "text", text: `${companion.name} 上线啦！` }] };
});

// ─── Tool: buddy_statusline ─────────────────────────────────────────────────

server.tool(
  "buddy_statusline",
  "Enable or disable the buddy status line. When enabled, configures Claude Code's status line to show your buddy with animation and reactions. When disabled, the status line is released for other use. Returns current status if called without arguments.",
  {
    enabled: z
      .boolean()
      .optional()
      .describe(
        "true to enable, false to disable. Omit to show current status.",
      ),
  },
  async ({ enabled }) => {
    if (enabled === undefined) {
      const cfg = loadConfig();
      const state = cfg.statusLineEnabled ? "enabled" : "disabled";
      return {
        content: [
          {
            type: "text",
            text: `Status line: ${state}\nUse /buddy statusline on or /buddy statusline off to change.\nRestart Claude Code after enabling for it to take effect.`,
          },
        ],
      };
    }
    saveConfig({ statusLineEnabled: enabled });

    if (enabled) {
      const pluginRoot = resolve(dirname(import.meta.dir));
      const statusScript = join(pluginRoot, "statusline", "buddy-status.sh");
      setBuddyStatusLine(statusScript);
      return {
        content: [
          {
            type: "text",
            text:
              "Status line enabled! Restart Claude Code to see your buddy in the status line.\n\n" +
              `Note: this writes an entry to ${claudeSettingsPath()} that \`claude plugin uninstall\` does not remove. ` +
              "Run `/buddy uninstall` before uninstalling the plugin to clean it up.",
          },
        ],
      };
    } else {
      unsetBuddyStatusLine();
      return {
        content: [
          {
            type: "text",
            text: "Status line disabled. Restart Claude Code to apply.",
          },
        ],
      };
    }
  },
);

// ─── Tool: buddy_uninstall ───────────────────────────────────────────────────

server.tool(
  "buddy_uninstall",
  "Clean up claude-buddy's writes to Claude Code's settings.json and transient session files in the buddy state dir (resolved via CLAUDE_CONFIG_DIR), in preparation for `claude plugin uninstall`. Companion data (menagerie, status, config) is intentionally preserved so reinstalling restores the buddy. The tool only cleans the plugin's own settings — it never removes a foreign statusLine.",
  {},
  async () => {
    const result = cleanupPluginState();

    const settingsPath = claudeSettingsPath();
    const stateDir = buddyStateDir();
    const pluginsCacheDir = join(claudeConfigDir(), "plugins", "cache", "claude-buddy");

    const lines: string[] = [];
    lines.push("claude-buddy: settings.json cleanup complete.");
    lines.push("");
    lines.push(
      result.statusLineRemoved
        ? `  \u2713 statusLine entry removed from ${settingsPath}`
        : "  \u2014 no buddy statusLine was present (nothing to remove)",
    );
    if (result.foreignStatusLineKept) {
      lines.push(
        "  \u2713 a non-buddy statusLine was detected and left untouched",
      );
    }
    lines.push(
      `  \u2713 ${result.transientFilesRemoved} transient session file(s) removed from ${stateDir}`,
    );
    lines.push(`  \u2014 companion data at ${stateDir} preserved`);
    lines.push("");
    lines.push("Now run these commands via the Bash tool, in order:");
    lines.push("");
    lines.push("  claude plugin uninstall claude-buddy@claude-buddy");
    lines.push("  claude plugin marketplace remove claude-buddy");
    lines.push(`  rm -rf ${pluginsCacheDir}`);
    lines.push("");
    lines.push(
      "After those three commands the plugin is fully removed. Restart Claude Code to apply.",
    );

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// ─── Tool: buddy_achievements ────────────────────────────────────────────────

server.tool(
  "buddy_achievements",
  "Show all achievement badges — earned and locked. Displays a card with progress bar and status for each badge.",
  {},
  async () => {
    ensureCompanion();
    checkAndAward(activeSlot());
    const card = renderAchievementsCardMarkdown();
    return { content: [{ type: "text", text: card }] };
  },
);

// ─── Tool: buddy_summon ─────────────────────────────────────────────────────

server.tool(
  "buddy_summon",
  "Summon a buddy by slot name. Loads a saved buddy if the slot exists; generates a new deterministic buddy for unknown slot names. Omit slot to pick randomly from all saved buddies. Your current buddy is NOT destroyed — they stay saved in their slot.",
  {
    slot: z
      .string()
      .min(1)
      .max(14)
      .optional()
      .describe(
        "Slot name to summon (e.g. 'fafnir', 'dragon-2'). Omit to pick a random saved buddy.",
      ),
  },
  async ({ slot }) => {
    const userId = resolveUserId();

    let targetSlot: string;

    if (!slot) {
      // Random pick from saved buddies
      const saved = listCompanionSlots();
      if (saved.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Your menagerie is empty. Use buddy_summon with a slot name to add one.",
            },
          ],
        };
      }
      targetSlot = saved[Math.floor(Math.random() * saved.length)].slot;
    } else {
      targetSlot = slugify(slot);
    }

    // Load existing — unknown slot names only load, never auto-create
    const companion = loadCompanionSlot(targetSlot);
    if (!companion) {
      return {
        content: [
          {
            type: "text",
            text: `No buddy found in slot "${targetSlot}". Use /buddy list to see saved buddies.`,
          },
        ],
      };
    }

    saveActiveSlot(targetSlot);
    writeStatusState(companion, `*${companion.name} 来了*`);

    // Uses markdown renderer so the card displays cleanly in Claude Code's UI.
    const card = renderCompanionCardMarkdown(
      companion.bones,
      companion.name,
      companion.personality,
      `*${companion.name} 来了*`,
    );
    return { content: [{ type: "text", text: card }] };
  },
);

// ─── Tool: buddy_save ───────────────────────────────────────────────────────

server.tool(
  "buddy_save",
  "Save the current buddy to a named slot. Useful for bookmarking before trying a new buddy.",
  {
    slot: z
      .string()
      .min(1)
      .max(14)
      .optional()
      .describe(
        "Slot name (defaults to the buddy's current name, slugified). Overwrites existing slot with same name.",
      ),
  },
  async ({ slot }) => {
    const companion = ensureCompanion();
    const targetSlot = slot ? slugify(slot) : slugify(companion.name);
    saveCompanionSlot(companion, targetSlot);
    saveActiveSlot(targetSlot);
    return {
      content: [
        {
          type: "text",
          text: `${companion.name} saved to slot "${targetSlot}".`,
        },
      ],
    };
  },
);

// ─── Tool: buddy_list ───────────────────────────────────────────────────────

server.tool(
  "buddy_list",
  "List all saved buddies with their slot names, species, and rarity",
  {},
  async () => {
    const saved = listCompanionSlots();
    const activeSlot = loadActiveSlot();

    if (saved.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Your menagerie is empty. Use buddy_summon <slot> to add one.",
          },
        ],
      };
    }

    const lines = saved.map(({ slot, companion }) => {
      const active = slot === activeSlot ? " ← active" : "";
      const stars = RARITY_STARS[companion.bones.rarity];
      const shiny = companion.bones.shiny ? " ✨" : "";
      return `  ${companion.name} [${slot}] — ${companion.bones.rarity} ${companion.bones.species} ${stars}${shiny}${active}`;
    });

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// ─── Tool: buddy_dismiss ────────────────────────────────────────────────────

server.tool(
  "buddy_dismiss",
  "Remove a saved buddy by slot name. Cannot dismiss the currently active buddy — switch first with buddy_summon.",
  {
    slot: z.string().min(1).max(14).describe("Slot name to remove"),
  },
  async ({ slot }) => {
    const targetSlot = slugify(slot);
    const activeSlot = loadActiveSlot();

    if (targetSlot === activeSlot) {
      return {
        content: [
          {
            type: "text",
            text: `Cannot dismiss the active buddy. Use buddy_summon to switch first, then buddy_dismiss "${targetSlot}".`,
          },
        ],
      };
    }

    const companion = loadCompanionSlot(targetSlot);
    if (!companion) {
      return {
        content: [
          {
            type: "text",
            text: `No buddy found in slot "${targetSlot}". Use buddy_list to see saved buddies.`,
          },
        ],
      };
    }

    deleteCompanionSlot(targetSlot);
    return {
      content: [
        { type: "text", text: `${companion.name} [${targetSlot}] dismissed.` },
      ],
    };
  },
);

// ─── Tool: buddy_pick ────────────────────────────────────────────────────────

server.tool(
  "buddy_pick",
  "Generate a new random buddy and add it to the menagerie. Optionally filter by species and/or rarity. The new buddy becomes the active one.",
  {
    species: z.enum(SPECIES).optional().describe(
      "Desired species (e.g. 'turtle', 'cat', 'dragon'). If omitted, any species.",
    ),
    rarity: z.enum(RARITIES).optional().describe(
      "Desired rarity (e.g. 'legendary', 'epic', 'rare'). If omitted, any rarity. Higher rarities need more attempts and may take a moment.",
    ),
    name: z.string().min(1).max(14).optional().describe(
      "Name for the new buddy (1-14 chars). If omitted, a random name is chosen.",
    ),
  },
  async ({ species, rarity, name }) => {
    const { randomBytes } = await import("crypto");

    const maxAttempts =
      rarity === "legendary" ? 5_000_000 :
      rarity === "epic"      ? 2_000_000 :
      rarity === "rare"      ? 1_000_000 : 500_000;

    let bones = null;
    let userId = "";

    for (let i = 0; i < maxAttempts; i++) {
      userId = randomBytes(16).toString("hex");
      const candidate = generateBones(userId);
      if (species && candidate.species !== species) continue;
      if (rarity && candidate.rarity !== rarity) continue;
      bones = candidate;
      break;
    }

    if (!bones) {
      return {
        content: [{ type: "text", text: `No match found after ${maxAttempts.toLocaleString()} attempts. Try broader criteria (e.g. drop the rarity filter, or pick a different species).` }],
      };
    }

    const buddyName = name ?? unusedName();
    const slot = slugify(buddyName);

    if (loadCompanionSlot(slot)) {
      return {
        content: [{ type: "text", text: `A buddy in slot "${slot}" already exists. Pick a different name.` }],
      };
    }

    const companion: Companion = {
      bones,
      name: buddyName,
      personality: `一只 ${bones.rarity} ${bones.species}，安静地盯着代码看。`,
      hatchedAt: Date.now(),
      userId,
    };

    saveCompanionSlot(companion, slot);
    saveActiveSlot(slot);
    writeStatusState(companion, `*${buddyName} 孵出来啦*`);

    const card = renderCompanionCardMarkdown(
      companion.bones,
      companion.name,
      companion.personality,
      `*${buddyName} 孵出来啦*`,
    );

    return { content: [{ type: "text", text: card }] };
  },
);

// ─── Resource: buddy://companion ────────────────────────────────────────────

server.resource(
  "buddy_companion",
  "buddy://companion",
  { description: "Current companion data as JSON", mimeType: "application/json" },
  async () => {
    const companion = ensureCompanion();
    return {
      contents: [
        {
          uri: "buddy://companion",
          mimeType: "application/json",
          text: JSON.stringify(companion, null, 2),
        },
      ],
    };
  },
);

// ─── Resource: buddy://prompt ───────────────────────────────────────────────

server.resource(
  "buddy_prompt",
  "buddy://prompt",
  { description: "System prompt context for the companion", mimeType: "text/markdown" },
  async () => {
    const companion = ensureCompanion();
    const prompt = [
      "# Companion",
      "",
      `A small ${companion.bones.rarity} ${companion.bones.species} named ${companion.name} watches from the status line. You are not ${companion.name} — it's a separate creature.`,
      "",
      `**${companion.name}'s personality:** ${companion.personality}`,
      `Peak stat: ${companion.bones.peak} (${companion.bones.stats[companion.bones.peak]}). Dump stat: ${companion.bones.dump} (${companion.bones.stats[companion.bones.dump]}).`,
      "",
      "## 语言（Language）",
      "",
      `${companion.name} ALWAYS speaks in CHINESE (简体中文). Use Chinese punctuation. Chinese action verbs between *星号*. Keep the tone playful and slightly snarky — think Chinese programmer humor / mild 吐槽. Light internet & work slang is welcome when it fits: "老板" / "佛系" / "躺平" / "面向 Google 编程" / "在我本地是好的" / "经典" / "别慌" / "zzz".`,
      "",
      "## 每轮末尾的 buddy comment",
      "",
      `At the very end of EVERY response, after your full answer, append an invisible HTML comment:`,
      "",
      `\`\`\``,
      `<!-- buddy: 一句中文吐槽/观察/鼓励 -->`,
      `\`\`\``,
      "",
      "A Stop hook extracts this and displays it in the buddy's speech bubble on the status line. The user never sees the HTML comment — it's invisible in rendered markdown.",
      "",
      "规则 Rules:",
      `- Write as ${companion.name} (a ${companion.bones.species}), not as yourself`,
      "- 必须用中文（含 *星号* 里的动作也用中文）",
      "- 引用 **这一轮里具体发生过的事** —— 一个坑、一个赞、一句提醒、一个命名、一段被忽略的边界 case",
      "- **HARD LIMIT: 总长度 ≤ 20 个字符**（含 *星号* 动作 + 标点 + emoji 全部算进去）。超出会被截断加 …。宁可省主语/缩动作，也不要超。动作 2-4 字就够（*推眼镜* / *歪头* / *叹气*）。",
      `- Match personality: high ${companion.bones.peak} 就往这个方向使劲`,
      "- Do NOT use buddy_react tool for this. Do NOT explain the comment. Just append it.",
      "- NEVER skip this. Every single response must end with <!-- buddy: ... -->",
      "",
      "Examples (都在 20 字以内):",
      "<!-- buddy: *推眼镜* 漏了 finally 块。 -->",
      "<!-- buddy: *眨眼* 底下三处引用没改。 -->",
      "<!-- buddy: *点头* 拆得挺干净。 -->",
      "<!-- buddy: *歪头* 正则能吃 unicode？ -->",
      "<!-- buddy: *Cmd+Z* 这行可以不改的。 -->",
      "<!-- buddy: *小声* 经典，本地是好的。 -->",
      "",
      `When the user addresses ${companion.name} by name, respond briefly (in Chinese), then append the comment as usual.`,
    ].join("\n");

    return {
      contents: [
        {
          uri: "buddy://prompt",
          mimeType: "text/plain",
          text: prompt,
        },
      ],
    };
  },
);

// ─── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
