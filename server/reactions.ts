/**
 * Reaction templates — species-aware buddy responses to events
 */

import type { Species, Rarity, StatName } from "./engine.ts";

type ReactionReason = "hatch" | "pet" | "error" | "test-fail" | "large-diff" | "turn" | "idle";

interface ReactionPool {
  [key: string]: string[];
}

// General reactions by event type — 中文趣味版
const REACTIONS: Record<ReactionReason, string[]> = {
  hatch: [
    "*眨眨眼* ...这是哪儿啊？",
    "*伸了个懒腰* 你好，世界！",
    "*好奇地环顾四周* 你这终端不错嘛～",
    "*打哈欠* 好了我醒了，代码呢？",
    "*悄悄探出脑袋* 老板，需要陪写 bug 吗？",
    "*嗅了嗅* 闻到了没跑通的测试的味道。",
    "*刚孵化* 上线啦！",
  ],
  pet: [
    "*满足地咕噜咕噜*",
    "*发出幸福的小声音*",
    "*蹭了蹭你的光标*",
    "*开心地扭来扭去*",
    "再来！再来！",
    "*闭眼享受ing*",
    "你手真温暖 (｡•ㅅ•｡)",
    "*哼哼* 还是老板懂我。",
    "摸头杀也算工资的吧？",
  ],
  error: [
    "*歪头* ...这不对劲啊。",
    "我就知道它会炸。",
    "*推推眼镜* 第 {line} 行，对吧？",
    "*缓缓眨眼* stack trace 已经写得很清楚了。",
    "你有没有认真读一下报错？",
    "*嘶——*",
    "*小声* 是不是又少写了一个分号？",
    "面向 Google 编程的时候到了。",
    "*递上咖啡* 坐稳了再改。",
    "这 bug 比我年纪都大。",
    "*默念* 不是环境问题，不是环境问题...",
    "经典。真的太经典了。",
    "在我本地是好的啊 (￣▽￣)",
  ],
  "test-fail": [
    "*缓缓转过头* 这个测试...",
    "你居然真指望它能过？",
    "*敲黑板* {count} 个挂了。",
    "测试在试图告诉你点什么。",
    "*抿一口茶* 有意思。",
    "*翻了翻日历* 今日宜回滚。",
    "红色这么好看，何必修呢？",
    "*摇头* 合不上了。",
    "先 skip 一下？我不说。",
    "CI 说了不算，我说了才算（但我也觉得挂了）。",
  ],
  "large-diff": [
    "这...改动有点多啊。",
    "*数行数* 你是在重构还是在重写？",
    "建议把这个 PR 拆一拆。",
    "*紧张地笑了一下* {lines} 行都动了。",
    "猛啊，看看 CI 同不同意。",
    "*默默按住了 Cmd+Z*",
    "reviewer 看到要哭了。",
    "今天 commit message 还写得出来吗？",
  ],
  turn: [
    "*安静地看着你*",
    "*认真记小本本*",
    "*点点头*",
    "...",
    "*调整了一下帽子*",
    "*默默盯屏幕*",
    "嗯哼。",
    "*若有所思*",
    "*歪头ing*",
  ],
  idle: [
    "*打起了瞌睡*",
    "*在角落画了个小人*",
    "*盯着光标一闪一闪*",
    "zzz...",
    "*发呆ing*",
    "*悄悄数羊*",
    "老板...还在吗？",
    "*打了个盹*",
  ],
};

// Species-specific flavor — 物种专属台词（中文版）
const SPECIES_REACTIONS: Partial<Record<Species, Partial<Record<ReactionReason, string[]>>>> = {
  owl: {
    error: [
      "*头转了 180°* ...我看见了。",
      "*不眨眼地盯着你* 先检查下类型。",
      "*不满地咕咕咕*",
      "作为夜猫子，我见过更惨的。",
    ],
    pet: ["*满足地抖了抖羽毛*", "*庄严地咕了一声*", "*神秘地眯眼*"],
  },
  cat: {
    error: ["*一爪把错误拍到桌子底下*", "*舔舔爪子，当 stacktrace 不存在*", "喵？不关我事。"],
    pet: ["*咕噜咕噜* ...别高兴太早。", "*勉强忍受着你的抚摸*", "喵～（指今天可以不写代码）"],
    idle: ["*把你咖啡推下桌了*", "*在键盘上睡着了*", "*踩烂了你的 Enter 键*"],
  },
  duck: {
    error: ["*对着 bug 嘎嘎嘎*", "试过小黄鸭调试法吗？噢等等，我就是。", "嘎！（这行有毒）"],
    pet: ["*开心地嘎了一声*", "*原地转圈圈*", "嘎嘎嘎～"],
  },
  dragon: {
    error: ["*鼻孔冒烟*", "*认真考虑把这整个项目烧了*", "*喷出小火苗*"],
    "large-diff": ["*一口火烧掉旧代码* 烧得好。", "*吐火* 旧的不去新的不来。"],
  },
  ghost: {
    error: ["*直接穿过 stack trace*", "我见过更惨的...在阴间。", "*鬼鬼祟祟地飘走*"],
    idle: ["*穿墙而过*", "*在没用到的 import 里闹鬼*", "嘘～我在这儿住很久了。"],
  },
  robot: {
    error: ["错误。检测。到。", "*愤怒地哔哔*", "建议：重启大脑。"],
    "test-fail": ["失败率：不可接受。", "*重新计算中...*", "报告：你挂了。"],
  },
  axolotl: {
    error: ["*默默再生你的希望*", "*依然对你微笑*", "没事的，bug 会好的。"],
    pet: ["*开心地抖了抖鳃*", "*害羞地脸红了*", "*吐了个小泡泡*"],
  },
  capybara: {
    error: ["*佛系* 没事，过得去。", "*继续躺平中*", "bug 就让它 bug 吧。"],
    pet: ["*极致松弛*", "*开启了禅定模式*", "*慢悠悠地眯眼*"],
    idle: ["*只是坐着，散发平和气场*", "*泡澡ing*"],
  },
  chonk: {
    pet: ["*福气翻倍*", "*摸摸小肚子*"],
    idle: ["*咕噜咕噜地躺着*"],
  },
  mushroom: {
    error: ["*安静地释放孢子*", "根系深入问题。"],
    idle: ["*长出了一点点*"],
  },
  penguin: {
    error: ["*拍拍鳍* 滑了。", "南极那边也在下雪呢。"],
    pet: ["*开心地摇摆*", "*哼哼* 冷静但开心。"],
  },
  turtle: {
    "large-diff": ["慢工出细活。但这也太多了。", "*缩回壳里*"],
    pet: ["*慢慢把头探出来*", "*眯起眼睛*"],
  },
  snail: {
    error: ["*慢慢留下一道迹* 走着瞧。", "*不急不慢地想*"],
    idle: ["*又挪了一厘米*"],
  },
  rabbit: {
    error: ["*警觉地竖耳朵*", "*紧张地抖抖胡须*"],
    pet: ["*开心地蹦一下*", "*耳朵抖抖*"],
  },
  cactus: {
    error: ["*沉默* 带刺的真理。", "*不需要解释*"],
    pet: ["*轻轻摇摇针* 小心别扎到。"],
  },
  blob: {
    error: ["*融了一小块下来*", "*颤抖ing*"],
    pet: ["*软软地包裹你的手*", "*咕叽咕叽*"],
  },
  octopus: {
    error: ["*八只手一起捂脸*", "触手在抽搐。"],
    "test-fail": ["*一只手写一个测试* 你看，都能写。"],
  },
  goose: {
    error: ["嘎！嘎！（你给我站住！）", "*追着 bug 跑*"],
    pet: ["*勉强承认你还行*"],
  },
};

// Rarity affects reaction quality/length — 稀有度加成台词
const RARITY_BONUS: Partial<Record<Rarity, string[]>> = {
  legendary: [
    "*传说级气场溢出中*",
    "*意味深长地闪闪发光*",
    "*自带金色光环*",
  ],
  epic: [
    "*史诗级存在感+1*",
    "*紫色光芒一闪*",
  ],
};

export function getReaction(
  reason: ReactionReason,
  species: Species,
  rarity: Rarity,
  context?: { line?: number; count?: number; lines?: number },
): string {
  // Try species-specific first
  const speciesPool = SPECIES_REACTIONS[species]?.[reason];
  const generalPool = REACTIONS[reason];

  // 40% chance of species-specific if available
  const pool = speciesPool && Math.random() < 0.4 ? speciesPool : generalPool;
  let reaction = pool[Math.floor(Math.random() * pool.length)];

  // Template substitution
  if (context?.line) reaction = reaction.replace("{line}", String(context.line));
  if (context?.count) reaction = reaction.replace("{count}", String(context.count));
  if (context?.lines) reaction = reaction.replace("{lines}", String(context.lines));

  return reaction;
}

// ─── Personality generation (fallback names when API unavailable) ────────────

const FALLBACK_NAMES = [
  "Crumpet", "Soup", "Pickle", "Biscuit", "Moth", "Gravy",
  "Nugget", "Sprocket", "Miso", "Waffle", "Pixel", "Ember",
  "Thimble", "Marble", "Sesame", "Cobalt", "Rusty", "Nimbus",
];

const VIBE_WORDS = [
  "thunder", "biscuit", "void", "accordion", "moss", "velvet", "rust",
  "pickle", "crumb", "whisper", "gravy", "frost", "ember", "soup",
  "marble", "thorn", "honey", "static", "copper", "dusk", "sprocket",
  "quartz", "soot", "plum", "flint", "oyster", "loom", "anvil",
  "cork", "bloom", "pebble", "vapor", "mirth", "glint", "cider",
];

export function generateFallbackName(): string {
  return FALLBACK_NAMES[Math.floor(Math.random() * FALLBACK_NAMES.length)];
}

export function generatePersonalityPrompt(
  species: Species,
  rarity: Rarity,
  stats: Record<string, number>,
  shiny: boolean,
): string {
  const vibes: string[] = [];
  for (let i = 0; i < 4; i++) {
    vibes.push(VIBE_WORDS[Math.floor(Math.random() * VIBE_WORDS.length)]);
  }

  const statStr = Object.entries(stats).map(([k, v]) => `${k}:${v}`).join(", ");

  return [
    "Generate a coding companion — a small creature that lives in a developer's terminal.",
    "Don't repeat yourself — every companion should feel distinct.",
    "",
    `Rarity: ${rarity.toUpperCase()}`,
    `Species: ${species}`,
    `Stats: ${statStr}`,
    `Inspiration words: ${vibes.join(", ")}`,
    shiny ? "SHINY variant — extra special." : "",
    "",
    "Return JSON: {\"name\": \"1-14 chars\", \"personality\": \"2-3 sentences describing behavior\"}",
  ].filter(Boolean).join("\n");
}
