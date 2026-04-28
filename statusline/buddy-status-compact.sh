#!/usr/bin/env bash
# claude-buddy-cn compact statusLine —— 单行版
#
# 为什么要单行版：
#   一些 Claude Code 版本（观察到 v2.1.112）在多行 statusLine + 频繁刷新下
#   会出现聊天内容重复叠加的 TUI bug。用单行 statusLine 可以绕过这个问题。
#
# 布局：<物种 emoji> <名字> <稀有度★> [✨] 💬 <反应文字>
# 示例：🐧 Jetsam ★★★★★ ✨ 💬 *推推眼镜* 这个 error handler 漏了 finally 块？
#
# 反应文字会根据终端宽度自动截断，防止折行（折行还是会触发相同 bug）。

[ "$BUDDY_SHELL" = "1" ] && exit 0

# shellcheck source=../scripts/paths.sh
source "$(dirname "${BASH_SOURCE[0]}")/../scripts/paths.sh"

STATE="$BUDDY_STATE_DIR/status.json"
[ -f "$STATE" ] || exit 0

MUTED=$(jq -r '.muted // false' "$STATE" 2>/dev/null)
[ "$MUTED" = "true" ] && exit 0

NAME=$(jq -r '.name // ""' "$STATE" 2>/dev/null)
[ -z "$NAME" ] && exit 0

SPECIES=$(jq -r '.species // ""' "$STATE" 2>/dev/null)
RARITY=$(jq -r '.rarity // "common"' "$STATE" 2>/dev/null)
SHINY=$(jq -r '.shiny // false' "$STATE" 2>/dev/null)
REACTION=$(jq -r '.reaction // ""' "$STATE" 2>/dev/null)
ACHIEVEMENT=$(jq -r '.achievement // ""' "$STATE" 2>/dev/null)

cat > /dev/null  # drain stdin

# ─── Species → emoji ─────────────────────────────────────────────────────────
case "$SPECIES" in
  duck)     EMO="🦆" ;;
  goose)    EMO="🪿" ;;
  blob)     EMO="🫧" ;;
  cat)      EMO="🐱" ;;
  dragon)   EMO="🐉" ;;
  octopus)  EMO="🐙" ;;
  owl)      EMO="🦉" ;;
  penguin)  EMO="🐧" ;;
  turtle)   EMO="🐢" ;;
  snail)    EMO="🐌" ;;
  ghost)    EMO="👻" ;;
  axolotl)  EMO="🦎" ;;
  capybara) EMO="🦫" ;;
  cactus)   EMO="🌵" ;;
  robot)    EMO="🤖" ;;
  rabbit)   EMO="🐰" ;;
  mushroom) EMO="🍄" ;;
  chonk)    EMO="🐷" ;;
  *)        EMO="🐾" ;;
esac

# ─── Rarity 星级 + 颜色 ──────────────────────────────────────────────────────
NC=$'\033[0m'
case "$RARITY" in
  common)    STARS="★";        C=$'\033[38;2;153;153;153m' ;;
  uncommon)  STARS="★★";       C=$'\033[38;2;78;186;101m' ;;
  rare)      STARS="★★★";      C=$'\033[38;2;177;185;249m' ;;
  epic)      STARS="★★★★";     C=$'\033[38;2;175;135;255m' ;;
  legendary) STARS="★★★★★";    C=$'\033[38;2;255;193;7m' ;;
  *)         STARS="★";        C=$'\033[0m' ;;
esac

SHINY_MARK=""
[ "$SHINY" = "true" ] && SHINY_MARK=" ✨"

# ─── 终端宽度探测（和原版同样做法，用于截断反应文字）──────────────────────────
COLS=0
PID=$$
for _ in 1 2 3 4 5; do
    PID=$(ps -o ppid= -p "$PID" 2>/dev/null | tr -d ' ')
    [ -z "$PID" ] || [ "$PID" = "1" ] && break
    PTY=$(readlink "/proc/${PID}/fd/0" 2>/dev/null)
    if [ -c "$PTY" ] 2>/dev/null; then
        COLS=$(stty size < "$PTY" 2>/dev/null | awk '{print $2}')
        [ "${COLS:-0}" -gt 40 ] 2>/dev/null && break
    fi
    TTY_NAME=$(ps -o tty= -p "$PID" 2>/dev/null | tr -d ' ')
    if [ -n "$TTY_NAME" ] && [ "$TTY_NAME" != "??" ]; then
        TTY_DEV="/dev/$TTY_NAME"
        [ -c "$TTY_DEV" ] 2>/dev/null && COLS=$(stty size < "$TTY_DEV" 2>/dev/null | awk '{print $2}')
        [ "${COLS:-0}" -gt 40 ] 2>/dev/null && break
    fi
done
[ "${COLS:-0}" -lt 40 ] && COLS=${COLUMNS:-0}
[ "${COLS:-0}" -lt 40 ] && COLS=125

# ─── 显示宽度辅助 ─────────────────────────────────────────────────────────────
disp_width() {
    local s="$1"
    [ -z "$s" ] && { echo 0; return; }
    python3 -c 'import sys, unicodedata
s = sys.argv[1]
def cw(c):
    o = ord(c)
    if o >= 0x1F000: return 2
    if 0x2600 <= o <= 0x27BF: return 2
    if unicodedata.east_asian_width(c) in ("W","F"): return 2
    return 1
print(sum(cw(c) for c in s))' "$s" 2>/dev/null || echo "${#s}"
}

# ─── 组装前缀：<emoji> <name> <stars>[shiny] ─────────────────────────────────
# emoji 显示宽度 2，空格 1，name 和 stars 显示宽度要动态算
DIM=$'\033[2;3m'
PREFIX_TEXT="${EMO} ${NAME} ${STARS}${SHINY_MARK}"
PREFIX_W=$(disp_width "$PREFIX_TEXT")

# ─── 反应气泡：💬 <reaction>，加 achievement 前缀（如有）───────────────────────
# 空反应就只显示 prefix
FULL_REACTION=""
if [ -n "$ACHIEVEMENT" ] && [ "$ACHIEVEMENT" != "null" ]; then
    FULL_REACTION="🏆 $ACHIEVEMENT"
fi
if [ -n "$REACTION" ] && [ "$REACTION" != "null" ]; then
    if [ -n "$FULL_REACTION" ]; then
        FULL_REACTION="$FULL_REACTION | $REACTION"
    else
        FULL_REACTION="$REACTION"
    fi
fi

# ─── 输出 ─────────────────────────────────────────────────────────────────────
if [ -z "$FULL_REACTION" ]; then
    # 只有 prefix
    printf '%b%s%b\n' "$C" "$PREFIX_TEXT" "$NC"
    exit 0
fi

# 有反应：直接拼上 💬 text，不做截断（长度由 AI 侧提示词约束到 ≤20 字符）
REACTION_DISP="$FULL_REACTION"

printf '%b%s%b %b💬%b %b%s%b\n' "$C" "$PREFIX_TEXT" "$NC" "$C" "$NC" "$DIM" "$REACTION_DISP" "$NC"
