#!/usr/bin/env bash
# claude-buddy status line — animated, right-aligned multi-line companion
#
# Animation matches the original:
#   - 500ms per tick, sequence: [0,0,0,0,1,0,0,0,-1,0,0,2,0,0,0]
#   - Frame -1 = blink (eyes replaced with "-")
#   - Frames 0,1,2 = the 3 idle art variants per species
#   - refreshInterval: 1s in settings.json cycles the animation
#
# Uses Braille Blank (U+2800) for padding — survives JS .trim()
#
# When running inside buddy-shell (the PTY wrapper), skip status line rendering
# so the buddy doesn't show up twice (once in status line, once in wrapper panel).
[ "$BUDDY_SHELL" = "1" ] && exit 0

# shellcheck source=../scripts/paths.sh
source "$(dirname "${BASH_SOURCE[0]}")/../scripts/paths.sh"

# ─── Helper: compute terminal display width of a string ──────────────────────
# Bash's ${#str} returns character count, NOT column width.
# CJK (East Asian Wide/Fullwidth) characters display as 2 columns in the
# terminal, so we need unicodedata.east_asian_width to get the real width.
# Fallback to character count if python3 is unavailable.
disp_width() {
    local s="$1"
    [ -z "$s" ] && { echo 0; return; }
    python3 -c 'import sys, unicodedata
s = sys.argv[1]
def cw(c):
    o = ord(c)
    # Emoji planes (Supplementary): U+1F000 and above display as 2 cols
    if o >= 0x1F000: return 2
    # Misc symbols + dingbats (contains many emoji like ★ ☆ ✨ 🌟ish)
    if 0x2600 <= o <= 0x27BF: return 2
    # CJK via East Asian Width (Wide / Fullwidth)
    if unicodedata.east_asian_width(c) in ("W","F"): return 2
    return 1
print(sum(cw(c) for c in s))' "$s" 2>/dev/null || echo "${#s}"
}

STATE="$BUDDY_STATE_DIR/status.json"
# Session ID: sanitized tmux pane number, or "default" outside tmux
SID="${TMUX_PANE#%}"
SID="${SID:-default}"

[ -f "$STATE" ] || exit 0

MUTED=$(jq -r '.muted // false' "$STATE" 2>/dev/null)
[ "$MUTED" = "true" ] && exit 0

NAME=$(jq -r '.name // ""' "$STATE" 2>/dev/null)
[ -z "$NAME" ] && exit 0

SPECIES=$(jq -r '.species // ""' "$STATE" 2>/dev/null)
HAT=$(jq -r '.hat // "none"' "$STATE" 2>/dev/null)
RARITY=$(jq -r '.rarity // "common"' "$STATE" 2>/dev/null)
REACTION=$(jq -r '.reaction // ""' "$STATE" 2>/dev/null)
ACHIEVEMENT=$(jq -r '.achievement // ""' "$STATE" 2>/dev/null)
# eye is written to status.json by writeStatusState (v2+); fall back to "°"
E=$(jq -r '.eye // "°"' "$STATE" 2>/dev/null)

cat > /dev/null  # drain stdin

# ─── Animation: frame from timestamp ─────────────────────────────────────────
# Original sequence: [0,0,0,0,1,0,0,0,-1,0,0,2,0,0,0] with 500ms ticks
# Since refreshInterval=1s, each call = 2 ticks. We use seconds as index.
SEQ=(0 0 0 0 1 0 0 0 -1 0 0 2 0 0 0)
SEQ_LEN=${#SEQ[@]}
NOW=$(date +%s)
FRAME_IDX=$(( NOW % SEQ_LEN ))
FRAME=${SEQ[$FRAME_IDX]}

BLINK=0
if [ "$FRAME" -eq -1 ]; then
    BLINK=1
    FRAME=0
fi

# ─── Rarity color (pC4 = dark theme, the default) ────────────────────────────
NC=$'\033[0m'
case "$RARITY" in
  common)    C=$'\033[38;2;153;153;153m' ;;
  uncommon)  C=$'\033[38;2;78;186;101m'  ;;
  rare)      C=$'\033[38;2;177;185;249m' ;;
  epic)      C=$'\033[38;2;175;135;255m' ;;
  legendary) C=$'\033[38;2;255;193;7m'   ;;
  *)         C=$'\033[0m' ;;
esac

B=$'\xe2\xa0\x80'  # Braille Blank U+2800

# ─── Terminal width ──────────────────────────────────────────────────────────
COLS=0
PID=$$
for _ in 1 2 3 4 5; do
    PID=$(ps -o ppid= -p "$PID" 2>/dev/null | tr -d ' ')
    [ -z "$PID" ] || [ "$PID" = "1" ] && break

    # Linux: read PTY device from /proc
    PTY=$(readlink "/proc/${PID}/fd/0" 2>/dev/null)
    if [ -c "$PTY" ] 2>/dev/null; then
        COLS=$(stty size < "$PTY" 2>/dev/null | awk '{print $2}')
        [ "${COLS:-0}" -gt 40 ] 2>/dev/null && break
    fi

    # macOS: /proc doesn't exist — get TTY name from process table
    TTY_NAME=$(ps -o tty= -p "$PID" 2>/dev/null | tr -d ' ')
    if [ -n "$TTY_NAME" ] && [ "$TTY_NAME" != "??" ] && [ "$TTY_NAME" != "?" ]; then
        TTY_DEV="/dev/$TTY_NAME"
        if [ -c "$TTY_DEV" ] 2>/dev/null; then
            COLS=$(stty size < "$TTY_DEV" 2>/dev/null | awk '{print $2}')
            [ "${COLS:-0}" -gt 40 ] 2>/dev/null && break
        fi
    fi
done
[ "${COLS:-0}" -lt 40 ] 2>/dev/null && COLS=${COLUMNS:-0}
[ "${COLS:-0}" -lt 40 ] 2>/dev/null && COLS=125

# ─── Species art: 3 frames each (F0, F1, F2) ────────────────────────────────
# Each frame = 4 lines (L1..L4). Selected by $FRAME.
case "$SPECIES" in
  duck)
    case $FRAME in
      0) L1="    __";     L2=" <(${E} )___"; L3="  (  ._>";   L4="   \`--'" ;;
      1) L1="    __";     L2=" <(${E} )___"; L3="  (  ._>";   L4="   \`--'~" ;;
      2) L1="    __";     L2=" <(${E} )___"; L3="  (  .__>";  L4="   \`--'" ;;
    esac ;;
  goose)
    case $FRAME in
      0) L1="  (${E}>";    L2="   ||";       L3=" _(__)_";   L4="  ^^^^" ;;
      1) L1="  (${E}>";    L2="   ||";       L3=" _(__)_";   L4="  ^^^^" ;;
      2) L1="  (${E}>>";   L2="   ||";       L3=" _(__)_";   L4="  ^^^^" ;;
    esac ;;
  blob)
    case $FRAME in
      0) L1=" .----.";    L2="( ${E}  ${E} )"; L3="(      )";  L4=" \`----'" ;;
      1) L1=".------.";   L2="( ${E}  ${E} )"; L3="(       )"; L4="\`------'" ;;
      2) L1="  .--.";     L2=" (${E}  ${E})";  L3=" (    )";   L4="  \`--'" ;;
    esac ;;
  cat)
    case $FRAME in
      0) L1=" /\\_/\\";   L2="( ${E}   ${E})"; L3="(  ω  )";  L4="(\")_(\")" ;;
      1) L1=" /\\_/\\";   L2="( ${E}   ${E})"; L3="(  ω  )";  L4="(\")_(\")~" ;;
      2) L1=" /\\-/\\";   L2="( ${E}   ${E})"; L3="(  ω  )";  L4="(\")_(\")" ;;
    esac ;;
  dragon)
    case $FRAME in
      0) L1="/^\\  /^\\"; L2="< ${E}  ${E} >"; L3="(  ~~  )"; L4="\`-vvvv-'" ;;
      1) L1="/^\\  /^\\"; L2="< ${E}  ${E} >"; L3="(      )"; L4="\`-vvvv-'" ;;
      2) L1="/^\\  /^\\"; L2="< ${E}  ${E} >"; L3="(  ~~  )"; L4="\`-vvvv-'" ;;
    esac ;;
  octopus)
    case $FRAME in
      0) L1=" .----.";   L2="( ${E}  ${E} )"; L3="(______)"; L4="/\\/\\/\\/\\" ;;
      1) L1=" .----.";   L2="( ${E}  ${E} )"; L3="(______)"; L4="\\/\\/\\/\\/" ;;
      2) L1=" .----.";   L2="( ${E}  ${E} )"; L3="(______)"; L4="/\\/\\/\\/\\" ;;
    esac ;;
  owl)
    case $FRAME in
      0) L1=" /\\  /\\";  L2="((${E})(${E}))"; L3="(  ><  )"; L4=" \`----'" ;;
      1) L1=" /\\  /\\";  L2="((${E})(${E}))"; L3="(  ><  )"; L4=" .----." ;;
      2) L1=" /\\  /\\";  L2="((${E})(-))";    L3="(  ><  )"; L4=" \`----'" ;;
    esac ;;
  penguin)
    case $FRAME in
      0) L1=" .---.";    L2=" (${E}>${E})";   L3="/(   )\\"; L4=" \`---'" ;;
      1) L1=" .---.";    L2=" (${E}>${E})";   L3="|(   )|";  L4=" \`---'" ;;
      2) L1=" .---.";    L2=" (${E}>${E})";   L3="/(   )\\"; L4=" \`---'" ;;
    esac ;;
  turtle)
    case $FRAME in
      0) L1=" _,--._";   L2="( ${E}  ${E} )"; L3="[______]"; L4="\`\`    \`\`" ;;
      1) L1=" _,--._";   L2="( ${E}  ${E} )"; L3="[______]"; L4=" \`\`  \`\`" ;;
      2) L1=" _,--._";   L2="( ${E}  ${E} )"; L3="[======]"; L4="\`\`    \`\`" ;;
    esac ;;
  snail)
    case $FRAME in
      0) L1="${E}   .--."; L2="\\  ( @ )";   L3=" \\_\`--'"; L4="~~~~~~~" ;;
      1) L1="${E}   .--."; L2="|  ( @ )";   L3=" \\_\`--'"; L4="~~~~~~~" ;;
      2) L1="${E}   .--."; L2="\\  ( @ )";   L3=" \\_\`--'"; L4=" ~~~~~~" ;;
    esac ;;
  ghost)
    case $FRAME in
      0) L1=" .----.";   L2="/ ${E}  ${E} \\"; L3="|      |"; L4="~\`~\`\`~\`~" ;;
      1) L1=" .----.";   L2="/ ${E}  ${E} \\"; L3="|      |"; L4="\`~\`~~\`~\`" ;;
      2) L1=" .----.";   L2="/ ${E}  ${E} \\"; L3="|      |"; L4="~~\`~~\`~~" ;;
    esac ;;
  axolotl)
    case $FRAME in
      0) L1="}~(____)~{"; L2="}~(${E}..${E})~{"; L3="  (.--.)";  L4="  (_/\\_)" ;;
      1) L1="~}(____){~"; L2="~}(${E}..${E}){~"; L3="  (.--.)";  L4="  (_/\\_)" ;;
      2) L1="}~(____)~{"; L2="}~(${E}..${E})~{"; L3="  ( -- )";  L4="  ~_/\\_~" ;;
    esac ;;
  capybara)
    case $FRAME in
      0) L1=" n______n"; L2="( ${E}    ${E} )"; L3=" (  oo  )"; L4=" \`------'" ;;
      1) L1=" n______n"; L2="( ${E}    ${E} )"; L3=" (  Oo  )"; L4=" \`------'" ;;
      2) L1=" u______n"; L2="( ${E}    ${E} )"; L3=" (  oo  )"; L4=" \`------'" ;;
    esac ;;
  cactus)
    case $FRAME in
      0) L1="n ____ n";  L2="||${E}  ${E}||"; L3="|_|  |_|"; L4="  |  |" ;;
      1) L1="  ____";    L2="n|${E}  ${E}|n"; L3="|_|  |_|"; L4="  |  |" ;;
      2) L1="n ____ n";  L2="||${E}  ${E}||"; L3="|_|  |_|"; L4="  |  |" ;;
    esac ;;
  robot)
    case $FRAME in
      0) L1=" .[||].";   L2="[ ${E}  ${E} ]"; L3="[ ==== ]"; L4="\`------'" ;;
      1) L1=" .[||].";   L2="[ ${E}  ${E} ]"; L3="[ -==- ]"; L4="\`------'" ;;
      2) L1=" .[||].";   L2="[ ${E}  ${E} ]"; L3="[ ==== ]"; L4="\`------'" ;;
    esac ;;
  rabbit)
    case $FRAME in
      0) L1="  (\\__/)";  L2=" ( ${E}  ${E} )"; L3="=(  ◡◡  )="; L4=" (\")__(\")" ;;
      1) L1="  (|__/)";   L2=" ( ${E}  ${E} )"; L3="=(  ◡◡  )="; L4=" (\")__(\")" ;;
      2) L1="  (\\__/)";  L2=" ( ${E}  ${E} )"; L3="=(  ◡◡  )="; L4=" (\")__(\")" ;;
    esac ;;
  mushroom)
    case $FRAME in
      0) L1=" -o-OO-o-"; L2="(________)";  L3="   |${E}${E}|"; L4="   |__|" ;;
      1) L1=" -O-oo-O-"; L2="(________)";  L3="   |${E}${E}|"; L4="   |__|" ;;
      2) L1=" -o-OO-o-"; L2="(________)";  L3="   |${E}${E}|"; L4="   |__|" ;;
    esac ;;
  chonk)
    case $FRAME in
      0) L1=" /\\    /\\"; L2="( ${E}    ${E} )"; L3=" (  ..  )"; L4=" \`------'" ;;
      1) L1=" /\\    /|";  L2="( ${E}    ${E} )"; L3=" (  ..  )"; L4=" \`------'" ;;
      2) L1=" /\\    /\\"; L2="( ${E}    ${E} )"; L3=" (  ..  )"; L4=" \`------'~" ;;
    esac ;;
  *)
    L1="(${E}${E})"; L2="(  )"; L3=""; L4="" ;;
esac

# ─── Blink: replace eyes with "-" ────────────────────────────────────────────
if [ "$BLINK" -eq 1 ]; then
    L1="${L1//${E}/-}"
    L2="${L2//${E}/-}"
    L3="${L3//${E}/-}"
    L4="${L4//${E}/-}"
fi

# ─── Hat ──────────────────────────────────────────────────────────────────────
HAT_LINE=""
case "$HAT" in
  crown)     HAT_LINE=" \\^^^/" ;;
  tophat)    HAT_LINE=" [___]" ;;
  propeller) HAT_LINE="  -+-" ;;
  halo)      HAT_LINE=" (   )" ;;
  wizard)    HAT_LINE="  /^\\" ;;
  beanie)    HAT_LINE=" (___)" ;;
  tinyduck)  HAT_LINE="  ,>" ;;
esac

# ─── Reaction bubble (with TTL check) ────────────────────────────────────────
BUBBLE=""
if [ -n "$ACHIEVEMENT" ] && [ "$ACHIEVEMENT" != "null" ] && [ "$ACHIEVEMENT" != "" ]; then
    BUBBLE=$'\xf0\x9f\x8f\x86'" $ACHIEVEMENT"
fi
# 反应文字最多 20 个字符（按 char count 截断，超出加 …）
if [ -n "$REACTION" ] && [ "$REACTION" != "null" ] && [ "$REACTION" != "" ]; then
    REACTION=$(python3 -c '
import sys
s = sys.argv[1]
n = 20
print(s if len(s) <= n else s[:n-1] + "…")
' "$REACTION" 2>/dev/null || echo "$REACTION")
fi
REACTION_FILE="$BUDDY_STATE_DIR/reaction.$SID.json"
REACTION_TTL=0
CONFIG_FILE="$BUDDY_STATE_DIR/config.json"
if [ -f "$CONFIG_FILE" ]; then
    _ttl=$(jq -r '.reactionTTL // 0' "$CONFIG_FILE" 2>/dev/null || echo 0)
    case "$_ttl" in ''|*[!0-9]*) ;; *) REACTION_TTL="$_ttl" ;; esac
fi
if [ -n "$REACTION" ] && [ "$REACTION" != "null" ] && [ "$REACTION" != "" ]; then
    FRESH=0
    if [ "$REACTION_TTL" -eq 0 ]; then
        FRESH=1
    elif [ -f "$REACTION_FILE" ]; then
        TS=$(jq -r '.timestamp // 0' "$REACTION_FILE" 2>/dev/null || echo 0)
        if [ "$TS" != "0" ]; then
            NOW=$(date +%s)
            AGE=$(( NOW - TS / 1000 ))
            [ "$AGE" -lt "$REACTION_TTL" ] && FRESH=1
        fi
    fi
    if [ "$FRESH" -eq 1 ]; then
        if [ -n "$BUBBLE" ]; then
            BUBBLE="$BUBBLE | \"${REACTION}\""
        else
            BUBBLE="\"${REACTION}\""
        fi
    fi
fi

# ─── Build art lines ─────────────────────────────────────────────────────────
ART_LINES=("$L1" "$L2" "$L3")
[ -n "$L4" ] && ART_LINES+=("$L4")

# ─── Center the name (CJK-aware) ─────────────────────────────────────────────
# Compute actual display widths: ART_WIDTH = max terminal-column-width of any
# art line; NAME_WIDTH = terminal-column-width of the buddy name (Chinese
# names display 2 cols per char, so bash's ${#name} undercounts).
ART_WIDTH=0
for _line in "${ART_LINES[@]}"; do
    _w=$(disp_width "$_line")
    [ "$_w" -gt "$ART_WIDTH" ] && ART_WIDTH=$_w
done
NAME_DISP_WIDTH=$(disp_width "$NAME")
# Ceiling division for odd-diff cases so the visual center lands slightly
# RIGHT of the art's leftmost column — compensates for art shapes that are
# wider on the bottom (e.g. penguin's /(   )\ vs  .---. top).
NAME_PAD=$(( (ART_WIDTH - NAME_DISP_WIDTH + 1) / 2 ))
[ "$NAME_PAD" -lt 0 ] && NAME_PAD=0
NAME_LINE="$(printf '%*s%s' "$NAME_PAD" '' "$NAME")"

# ─── Build all art lines ──────────────────────────────────────────────────────
DIM=$'\033[2;3m'

ALL_LINES=()
ALL_COLORS=()
[ -n "$HAT_LINE" ] && { ALL_LINES+=("$HAT_LINE"); ALL_COLORS+=("$C"); }
for line in "${ART_LINES[@]}"; do
    ALL_LINES+=("$line"); ALL_COLORS+=("$C")
done
ALL_LINES+=("$NAME_LINE"); ALL_COLORS+=("$DIM")

ART_W=14
ART_COUNT=${#ALL_LINES[@]}

# ─── Speech bubble (left of art, word-wrapped) ──────────────────────────────
# Strip the quotes we added earlier
BUBBLE_TEXT=""
if [ -n "$BUBBLE" ]; then
    BUBBLE_TEXT="${BUBBLE%\"}"
    BUBBLE_TEXT="${BUBBLE_TEXT#\"}"
fi

# ─── Word-wrap bubble text (CJK-aware) ───────────────────────────────────────
INNER_W=28
TEXT_LINES=()
if [ -n "$BUBBLE_TEXT" ]; then
    # One python call that handles wrap + CJK width correctly.
    # Splits on whitespace; if a single token is still too wide (e.g. a long
    # Chinese run with no spaces), it further breaks on character boundary.
    # Use `while read` instead of bash-4 mapfile so this works on macOS bash 3.2.
    _wrapped=$(python3 -c '
import sys, unicodedata
text = sys.argv[1]
maxw = int(sys.argv[2])
def cw(c):
    o = ord(c)
    if o >= 0x1F000: return 2
    if 0x2600 <= o <= 0x27BF: return 2
    if unicodedata.east_asian_width(c) in ("W","F"): return 2
    return 1
def sw(s): return sum(cw(c) for c in s)
def break_long(s, w):
    out=[]; cur=""; curw=0
    for ch in s:
        chw = cw(ch)
        if curw + chw > w and cur:
            out.append(cur); cur=ch; curw=chw
        else:
            cur += ch; curw += chw
    if cur: out.append(cur)
    return out
lines=[]; cur=""
for word in text.split():
    if sw(word) > maxw:
        if cur: lines.append(cur); cur=""
        lines.extend(break_long(word, maxw)); continue
    if not cur: cur = word
    elif sw(cur) + 1 + sw(word) <= maxw: cur = cur + " " + word
    else: lines.append(cur); cur = word
if cur: lines.append(cur)
for ln in lines: print(ln)
' "$BUBBLE_TEXT" "$INNER_W" 2>/dev/null)
    if [ -n "$_wrapped" ]; then
        while IFS= read -r _ln; do TEXT_LINES+=("$_ln"); done <<< "$_wrapped"
    else
        # Fallback if python3 unavailable or failed: naive char-count wrap
        WORDS=($BUBBLE_TEXT)
        CUR_LINE=""
        for word in "${WORDS[@]}"; do
            if [ -z "$CUR_LINE" ]; then CUR_LINE="$word"
            elif [ $(( ${#CUR_LINE} + 1 + ${#word} )) -le $INNER_W ]; then CUR_LINE="$CUR_LINE $word"
            else TEXT_LINES+=("$CUR_LINE"); CUR_LINE="$word"
            fi
        done
        [ -n "$CUR_LINE" ] && TEXT_LINES+=("$CUR_LINE")
    fi
fi

TEXT_COUNT=${#TEXT_LINES[@]}

# Build box as plain strings (no ANSI). Color applied at output time.
# Box display width = INNER_W + 4:  "| " + text(INNER_W) + " |"
BOX_W=$(( INNER_W + 4 ))
BUBBLE_LINES=()
BUBBLE_TYPES=()  # "border" or "text" — determines coloring
if [ $TEXT_COUNT -gt 0 ]; then
    # Top border
    BORDER=$(printf '%*s' "$(( BOX_W - 2 ))" '' | tr ' ' '-')
    BUBBLE_LINES+=(".${BORDER}.")
    BUBBLE_TYPES+=("border")
    # Text rows: "| text padded |"  (CJK-aware padding)
    for tl in "${TEXT_LINES[@]}"; do
        tw=$(disp_width "$tl")
        tpad=$(( INNER_W - tw ))
        [ "$tpad" -lt 0 ] && tpad=0
        padding=$(printf '%*s' "$tpad" '')
        BUBBLE_LINES+=("| ${tl}${padding} |")
        BUBBLE_TYPES+=("text")
    done
    # Bottom border
    BUBBLE_LINES+=("\`${BORDER}'")
    BUBBLE_TYPES+=("border")
fi

BUBBLE_COUNT=${#BUBBLE_LINES[@]}

# ─── Right-align with bubble box to the left ─────────────────────────────────
GAP=2
if [ $BUBBLE_COUNT -gt 0 ]; then
    TOTAL_W=$(( BOX_W + GAP + ART_W ))
else
    TOTAL_W=$ART_W
fi
MARGIN=8
PAD=$(( COLS - TOTAL_W - MARGIN ))
[ "$PAD" -lt 0 ] && PAD=0

SPACER=$(printf "${B}%${PAD}s" "")
GAP_STR=$(printf '%*s' "$GAP" '')

# Vertically center bubble box on the art
BUBBLE_START=0
if [ $BUBBLE_COUNT -gt 0 ] && [ $BUBBLE_COUNT -lt $ART_COUNT ]; then
    BUBBLE_START=$(( (ART_COUNT - BUBBLE_COUNT) / 2 ))
fi

# ─── Find the connector line (middle text line → points to buddy's mouth) ─────
# The connector goes on the middle text row of the bubble
CONNECTOR_BI=-1
if [ $BUBBLE_COUNT -gt 2 ]; then
    # text rows are indices 1..(BUBBLE_COUNT-2), pick the middle one
    FIRST_TEXT=1
    LAST_TEXT=$(( BUBBLE_COUNT - 2 ))
    CONNECTOR_BI=$(( (FIRST_TEXT + LAST_TEXT) / 2 ))
fi

# ─── Output: merged bubble box + connector + art per line ─────────────────────
for (( i=0; i<ART_COUNT; i++ )); do
    art_part="${ALL_COLORS[$i]}${ALL_LINES[$i]}${NC}"

    if [ $BUBBLE_COUNT -gt 0 ]; then
        bi=$(( i - BUBBLE_START ))
        if [ $bi -ge 0 ] && [ $bi -lt $BUBBLE_COUNT ]; then
            bline="${BUBBLE_LINES[$bi]}"
            btype="${BUBBLE_TYPES[$bi]}"

            # Connector: "-- " on the middle text line, spaces otherwise
            if [ $bi -eq $CONNECTOR_BI ]; then
                gap="${C}--${NC} "
            else
                gap="   "
            fi

            if [ "$btype" = "border" ]; then
                echo "${SPACER}${C}${bline}${NC}${gap}${art_part}"
            else
                pipe_l="${bline:0:1}"
                pipe_r="${bline: -1}"
                inner="${bline:1:$(( ${#bline} - 2 ))}"
                echo "${SPACER}${C}${pipe_l}${NC}${DIM}${inner}${NC}${C}${pipe_r}${NC}${gap}${art_part}"
            fi
        else
            empty=$(printf '%*s' "$BOX_W" '')
            echo "${SPACER}${empty}   ${art_part}"
        fi
    else
        echo "${SPACER}${art_part}"
    fi
done

exit 0
