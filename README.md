<div align="center">

# 🐾 claude-buddy-cn

### Claude Code 永久宠物伴侣 · 汉化版

[![基于](https://img.shields.io/badge/基于-1270011/claude--buddy-6366f1?style=flat-square)](https://github.com/1270011/claude-buddy)
[![License](https://img.shields.io/github/license/hanliang97/claude-buddy-cn?style=flat-square&color=10b981)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-v2.1.80%2B-8b5cf6?style=flat-square)](https://claude.ai/code)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-blue?style=flat-square)](#系统要求)
[![MCP](https://img.shields.io/badge/powered%20by-MCP-ec4899?style=flat-square)](https://modelcontextprotocol.io)

> 这是 **[1270011/claude-buddy](https://github.com/1270011/claude-buddy)** 的**汉化版 fork**。核心引擎、MCP 协议、架构全部来自上游；本仓库只做了三件事：**(1)** 把宠物所有反应文案翻译成有趣的中文；**(2)** 改造给 AI 的 system prompt 让 Claude 用中文写每轮末尾的吐槽评语；**(3)** 修复状态栏在中文/emoji 下的对齐 bug。所有实质性功能请以上游为准。

</div>

---

## 🎯 这个仓库是什么

Anthropic 在 **Claude Code v2.1.97** 把 `/buddy` 命令移除了，配套的宠物算法代码也一起删掉了。上游项目 **claude-buddy** 用 MCP server + Skill + StatusLine + Hooks 的官方扩展点**重新实现**了同样的宠物系统，保证无论 Claude Code 后续怎么升级，你的 buddy 都不会再被拿走。

**claude-buddy-cn** 在此基础上针对中文用户做了三项本地化：

| 改动 | 文件 | 说明 |
|---|---|---|
| 🀄 **反应文案全中文 + 程序员梗** | [`server/reactions.ts`](server/reactions.ts) | 通用反应（孵化/摸头/报错/测试挂/大 diff/idle）+ 物种专属台词 + 稀有度加成台词，全部替换成中文并加入"老板/佛系/躺平/面向 Google 编程/在我本地是好的/经典"等中文编程圈梗 |
| 🤖 **AI 评语强制中文** | [`server/index.ts`](server/index.ts) | MCP server 暴露给 Claude 的 `instructions` 和 `buddy://prompt` 资源增加强制性语言约束（含 *动作* 也用中文），并给出中文示例，杜绝"中文人设说英文"的割裂感 |
| 📐 **中日韩字符宽度修复** | [`statusline/buddy-status.sh`](statusline/buddy-status.sh) | 上游用 bash `${#字符串}` 按字符数算 padding，但中文 / emoji 在终端占 2 列，结果气泡右边框跑偏、企鹅错位。本 fork 改用 Python `unicodedata.east_asian_width` 精确计算显示宽度，并兼容 macOS bash 3.2（去掉 `mapfile`） |

<br>

<div align="center">

### 修复前 → 修复后

修复前（上游）：气泡在中文下右边框被"挤"出去，企鹅不对齐

修复后：左右 `|` 严格对齐，emoji/中文/英文混排都 OK

</div>

---

## 📋 系统要求

| 需求 | 安装 |
|---|---|
| [**Bun**](https://bun.sh) | `curl -fsSL https://bun.sh/install \| bash` |
| **Claude Code** v2.1.80+ | 任何支持 MCP 的版本都可以 |
| **jq** | `brew install jq` / `apt install jq` |
| **python3** | macOS / 多数 Linux 发行版自带 |

平台：**macOS + Linux**。Windows 理论可以但我没测过。

---

## 🚀 快速开始

> ⚠️ **只走手动安装（`bun run install-buddy`），不要用 `/plugin marketplace add` 的 plugin 安装方式。** 仓库里虽然有 `.claude-plugin/*.json`（从上游继承来的 plugin 元数据），但在 Claude Code v2.1.97+ 的一些版本上 plugin 加载路径不稳定 —— marketplace 认不出、`/buddy` 命令不注册。手动安装通过 `~/.claude.json` 注册 MCP server + 改 `~/.claude/settings.json` 写 hooks/statusLine，是**实测最可靠的路径**。详见 [Known Issues](#-known-issues)。

```bash
git clone https://github.com/hanliang97/claude-buddy-cn.git
cd claude-buddy-cn
bun install
bun run install-buddy
```

然后**完全退出 Claude Code 再重新打开**（MCP server、hooks、statusLine 都只在会话启动时加载），状态栏就会出现你的 buddy。

**如果 `/buddy` 敲不出来（Unknown command）也不要慌**：你的 Claude Code 版本可能不扫 `~/.claude/commands/*.md`（这是某些本地构建的 bug）。但**核心功能不依赖 `/buddy` 命令**：
- ✅ 状态栏的 buddy 动画 + 金色稀有度颜色
- ✅ 每轮回复末尾 AI 自动冒出的中文吐槽气泡（Stop hook 驱动）
- ✅ PostToolUse hook 检测 bash 报错/测试挂/大 diff 后 buddy 的实时反应
- ✅ 直接跟 AI 说"摸摸 buddy"/"看看 buddy 状态"/"改名叫 XXX"，AI 会调对应的 MCP 工具（`buddy_pet` / `buddy_show` / `buddy_rename` 等）

### 想要一只金色传说？

```bash
# 在 Claude Code 里
/buddy pick rarity legendary species penguin name 我的宠物
```

或者用 CLI 的暴力搜索 TUI：

```bash
bun run pick
```

### 多 Claude 配置（工作 / 个人分开）

安装时带上 `CLAUDE_CONFIG_DIR`：

```bash
CLAUDE_CONFIG_DIR=~/.claude-personal bun run install-buddy
CLAUDE_CONFIG_DIR=~/.claude-personal bun run uninstall
```

---

## 🎨 中文文案示例一览

让你知道你会看到啥。每个事件都有多条候选随机抽：

**孵化**
- *伸了个懒腰* 你好，世界！
- *打哈欠* 好了我醒了，代码呢？
- *悄悄探出脑袋* 老板，需要陪写 bug 吗？

**摸头**
- *满足地咕噜咕噜*
- 摸头杀也算工资的吧？
- 你手真温暖 (｡•ㅅ•｡)

**报错**
- *推推眼镜* 第 {line} 行，对吧？
- 面向 Google 编程的时候到了。
- *默念* 不是环境问题，不是环境问题...
- 经典。真的太经典了。
- 在我本地是好的啊 (￣▽￣)

**测试失败**
- 先 skip 一下？我不说。
- 红色这么好看，何必修呢？
- CI 说了不算，我说了才算（但我也觉得挂了）。

**大 diff**
- *默默按住了 Cmd+Z*
- reviewer 看到要哭了。
- 今天 commit message 还写得出来吗？

**物种专属**（节选）
- 🐱 猫：*一爪把错误拍到桌子底下* / *把你咖啡推下桌了*
- 🐉 龙：*鼻孔冒烟* / *一口火烧掉旧代码*
- 🦫 水豚：*佛系* 没事，过得去。 / *极致松弛*
- 👻 幽灵：*直接穿过 stack trace* / 我见过更惨的...在阴间。
- 🤖 机器人：错误。检测。到。/ *愤怒地哔哔*
- 🐧 企鹅：*拍拍鳍* 滑了。/ 南极那边也在下雪呢。

**稀有度加成**
- legendary: *传说级气场溢出中* / *自带金色光环*
- epic: *史诗级存在感+1* / *紫色光芒一闪*

**AI 每轮评语**（Claude 自己写，每次都不一样）

示例：
```
<!-- buddy: *推推眼镜* 这个错误处理是不是漏了 finally 块？ -->
<!-- buddy: *默默点头* 函数拆得挺清爽。 -->
<!-- buddy: *歪头* 你确定这个正则处理得了 unicode 吗？ -->
<!-- buddy: *默默按住 Cmd+Z* 这一行可以不改的。 -->
```

---

## 🧩 功能清单（继承自上游）

- 🐙 **18 种物种**：duck / goose / blob / cat / dragon / octopus / owl / penguin / turtle / snail / ghost / axolotl / capybara / cactus / robot / rabbit / mushroom / chonk
- ⭐ **5 级稀有度**：common 60% / uncommon 25% / rare 10% / epic 4% / legendary 1%，shiny 另有 1%
- 📊 **5 维属性**：DEBUGGING · PATIENCE · CHAOS · WISDOM · SNARK
- 🎭 **事件感知**：PostToolUse hook 检测 bash 输出里的 error / test-fail / large-diff，buddy 会对应反应
- 💬 **Stop hook** 提取 AI 每轮末尾的 `<!-- buddy: ... -->` 注释到状态栏气泡
- 🎨 **24-bit true color** 稀有度渐变（金 / 紫 / 蓝 / 绿 / 灰）
- 💾 **菜园子（menagerie）**：可以存多只 buddy，`/buddy summon` 切换
- 🏆 **成就系统**（来自上游贡献者 ndcorder）

详细命令清单和实现原理见 [上游 README](https://github.com/1270011/claude-buddy#readme)，不再重复。

---

## 🔧 安装器做了什么

运行 `bun run install-buddy` 时：

1. 在 `~/.claude.json` 的 `mcpServers` 下注册 `claude-buddy` MCP server
2. 复制 skill 到 `~/.claude/skills/buddy/SKILL.md`
3. 往 `~/.claude/settings.json` 加一条 `statusLine`（默认每秒刷一次驱动动画，可自行改成更慢省电）
4. 加三个 hook：`PostToolUse[Bash]` / `Stop` / `UserPromptSubmit`
5. 加 MCP 权限 `mcp__claude_buddy__*`
6. 创建 `~/.claude-buddy/` 存放 menagerie 和 status

**卸载**：`bun run uninstall`（会清理上面所有改动；companion 数据保留在 `~/.claude-buddy/`，下次装回来就恢复）。

**省电**：改 `~/.claude/settings.json` 的 `statusLine.refreshInterval`（默认 1 秒 → 建议 5 / 10 / 20 秒，代价是动画不那么流畅）。

---

## 🛠️ 自定义文案

想加新段子？改 `server/reactions.ts`。这里有：

```
REACTIONS              → 通用反应（按事件类型: hatch/pet/error/test-fail/large-diff/turn/idle）
SPECIES_REACTIONS      → 物种专属（覆盖通用反应，有 40% 概率触发）
RARITY_BONUS           → 稀有度加成（暂未在主路径调用，供扩展用）
```

改完跑 `bun test` 保证没破坏格式，重启 Claude Code 生效。

想改 AI 评语风格？改 `server/index.ts` 里的 `getInstructions()` 和 `buddy_prompt` 资源 —— 那是给 Claude 看的 system prompt。

---

## 🐛 排障

| 现象 | 排查 |
|---|---|
| `/buddy` → `Unknown command: /buddy` | 你的 Claude Code 版本不扫 `~/.claude/commands/*.md`（某些本地构建 bug）。**不影响核心功能** —— 状态栏宠物 + AI 自动吐槽气泡 + MCP 工具调用都不依赖 `/buddy`。想快捷调用时可以直接跟 AI 说"摸摸 buddy" / "看看 buddy 状态"，AI 会调相应的 `mcp__claude_buddy__*` 工具 |
| 状态栏没有宠物 | `bun run doctor` 看 python3 / bun / jq 是否齐全；重启 Claude Code |
| 宠物说英文 | MCP 的 `instructions` 只在**会话开始**加载一次，装完要**完全退出并重启** Claude Code（不是 reload） |
| 中文气泡对齐还是歪的 | 确认用的是本 fork（`server/reactions.ts` 里有中文字），不是上游；缺 `python3` 会降级到上游的 byte-count 算法 |
| 风扇呼呼转 | `statusLine.refreshInterval` 调大。本 fork 默认 **10 秒**；嫌太频繁可以改成 20（动画基本静止但反应文字不受影响）；想看流畅的 idle 动画改成 1 |
| `mapfile: command not found` | 你用的是 bash 3.2（macOS 默认） + 老版 statusline。本 fork 已兼容 bash 3.2 |
| MCP server 找不到 bun | `~/.claude.json` 里 `mcpServers.claude-buddy.command` 如果是 `"bun"`（相对路径），GUI 启动的 Claude Code 可能 PATH 里没 `~/.bun/bin`。改成绝对路径 `/Users/xxx/.bun/bin/bun` |
| `/plugin install claude-buddy-cn` 报错 / 不生效 | **不要用 plugin 方式**，见本文档顶部的 "⚠️ 只走手动安装" 警告。走 `bun run install-buddy` |

---

## 📌 Known Issues

### Plugin 安装模式不稳定

仓库里保留了 `.claude-plugin/plugin.json` 和 `.claude-plugin/marketplace.json`（是从上游 [1270011/claude-buddy](https://github.com/1270011/claude-buddy) 继承来的 plugin 元数据），**但我们实测在 Claude Code v2.1.112 上 plugin 方式不工作**：

- `/plugin marketplace add` 有时候不把仓库加到 `known_marketplaces.json`（可能和 URL 解析 / 网络环境有关）
- 即使手工把条目注入了 `known_marketplaces.json` + `installed_plugins.json` + 启用了 plugin，`/buddy` 命令也不一定出现
- 其他 slash command 插件在同一台 Claude Code 上可能也有类似问题 —— 说明是**本地 Claude Code 的命令加载层**的问题，不是 claude-buddy-cn 的 bug

**结论：只用 `bun run install-buddy`**。安装器会：
1. 往 `~/.claude.json` 的 `mcpServers` 注册 `claude-buddy` MCP server
2. 往 `~/.claude/settings.json` 写 `statusLine` + 三个 hooks + `permissions.allow` 追加 `mcp__claude_buddy__*`
3. 复制 `skills/buddy/SKILL.md` 到 `~/.claude/skills/buddy/SKILL.md` 和 `~/.claude/commands/buddy.md`
4. 初始化 `~/.claude-buddy/menagerie.json` 生成第一只 buddy

整个流程**不经过 Claude Code 的 plugin 系统**，避开了上面的 bug。

### macOS GUI 启动 Claude Code 时 MCP server 启动失败

如果你从 Dock / Spotlight / Launchpad 启动 Claude Code（不是从终端），`~/.bun/bin` 可能不在 PATH 里，MCP server 启动会失败。**解决**：把 `~/.claude.json` 里 `mcpServers.claude-buddy.command` 从 `"bun"` 改成绝对路径 `"/Users/<你>/.bun/bin/bun"`。安装器默认写相对路径，记得手工改一下。

### 多行 ASCII art 可能触发"聊天重复"bug（compact 单行版作为备选）

默认安装的是 **多行 ASCII art 版**（`statusline/buddy-status.sh`）—— 那只会眨眼、歪头、带气泡的 6 行宠物，是这个项目的精髓。

**但有个已知的 Claude Code TUI bug**：在**某些版本**（**实测 v2.1.112**）上，多行 statusLine + 频繁刷新会触发 TUI 重绘缺陷 —— 每次 statusLine 刷新，旧的 6 行被推进 scrollback 但没清干净，**看起来像聊天内容在终端里"重复叠加"**。症状特征：

- 最近几轮对话的内容**每隔 refreshInterval 秒就往上滚一次**
- scrollback 里能看到同一段话**重复了很多遍**
- 静音 buddy（`jq '.muted = true' ~/.claude-buddy/status.json`）后现象立刻消失 → 证明是 statusLine 引起的

**如果你遇到这个 bug**：切到 compact 单行版，它只输出 1 行，避开这个 TUI bug。

```bash
# 切到 compact 版（本 fork 已内置脚本，不用重装）
python3 -c "
import json, pathlib
p = pathlib.Path.home() / '.claude' / 'settings.json'
d = json.loads(p.read_text())
d['statusLine']['command'] = d['statusLine']['command'].replace(
    'buddy-status.sh', 'buddy-status-compact.sh')
p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + chr(10))
print('✓ switched to compact single-line statusLine')
"
```

compact 版长这样：

```
🐧 Jetsam ★★★★★ ✨ 💬 *推推眼镜* 这个 error handler 漏了 finally 块？
```

- 物种 emoji（18 种全覆盖：🦆🪿🫧🐱🐉🐙🦉🐧🐢🐌👻🦎🦫🌵🤖🐰🍄🐷）
- 名字 + 稀有度 ★★★★★ + 传说色 + shiny ✨
- 💬 + 反应文字（根据终端宽度自动截断）

想切回多行版：把上面脚本里的 `buddy-status.sh` 和 `buddy-status-compact.sh` 位置对调。

**折中方案**：多行版 + **提高 `refreshInterval` 到 30 或 60**。刷新间隔拉长后，TUI bug 触发频率大大降低，多数情况下感知不到；代价是 idle 帧动画基本看不出动（反应文字仍然实时写入 status.json，下次刷新就能看到）。

### refreshInterval 默认 10 秒（相比上游的 1 秒）

上游 claude-buddy 默认 `statusLine.refreshInterval: 1`（每秒刷新驱动 idle 动画）—— 这在 MacBook 上风扇会明显转起来，因为每秒都要重新 spawn bun + 跑 statusLine 脚本。本 fork 改成 **10 秒**作为默认值，在"能看到动画"和"省电"之间取平衡。

`bun run install-buddy` 安装后你会得到：

```json
"statusLine": {
  "type": "command",
  "command": "/path/to/claude-buddy-cn/statusline/buddy-status.sh",
  "padding": 1,
  "refreshInterval": 10
}
```

| 值 | 效果 | 适合场景 |
|---|---|---|
| `1` | 流畅 idle 动画（原上游默认） | 台式机接电源，不在意风扇 |
| `10` | **本 fork 默认** —— 动画基本可见，但几乎不耗电 | MacBook 平衡选择 |
| `20+` | idle 动画几乎看不出来 | 极省电；反应文字（错误/测试挂/AI 评语）还是会在事件触发的那一瞬间写入 status.json，下次刷新就能看到 |

**核心反应文字不依赖 refreshInterval**。hook 触发时会立即写入 status.json，哪怕 refreshInterval 是 60 秒，下次刷新也会看到最新的反应。refreshInterval 只影响 idle 时的帧动画流畅度。

装完后想临时改的话，直接编辑 `~/.claude/settings.json` 的 `statusLine.refreshInterval` 字段，改完重启 Claude Code。

---

## 🙏 致上游 & 原始致谢

**没有上游就没有这个 fork。** 下面的贡献者的工作我 100% 站在肩膀上：

- [**@1270011**](https://github.com/1270011/claude-buddy) —— 把被移除的 `/buddy` 用 MCP + Skill + StatusLine + Hooks 重新实现的总工程师
- [**@doctor-ew**](https://github.com/doctor-ew) —— 多 buddy / TUI picker（menagerie）系统
- [**@ndcorder**](https://github.com/ndcorder) —— 成就徽章系统
- **Anthropic** —— 最初的 buddy 概念（Claude Code v2.1.89 – v2.1.94）
- [any-buddy](https://github.com/cpaczek/any-buddy) / [buddy-reroll](https://github.com/grayashh/buddy-reroll) / [ccbuddyy](https://github.com/vibenalytics/ccbuddyy) —— 上游提到的早期启发项目
- [Model Context Protocol](https://modelcontextprotocol.io) —— 这一切得以实现的底层协议

**如果你喜欢这个项目，请先去 [⭐ 1270011/claude-buddy](https://github.com/1270011/claude-buddy) 点个 star**，再回来看我这个汉化版。

---

## 📜 License

MIT —— 随便用。**本 fork 保留上游原始版权声明 + 追加本 fork 的版权声明**（见 [LICENSE](LICENSE)）。如果你做二次分发，请继续保留两条版权 + 在显著位置标注"基于 1270011/claude-buddy"。

---

<div align="center">

_如果官方哪天又把 buddy 加回来了，欢迎删掉这个仓库。_ 🐧

</div>
