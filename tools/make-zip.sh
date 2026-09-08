#!/usr/bin/env bash
# 배포용 zip 만들기 — 관리 화면이 소유하는 파일은 넣지 않는다(덮어써도 올린 작품·고친 글이 남게).
#   기본 제외: data/overrides.json · content/*.md(이야기 글) · media/*/works/(올린 카드)
#   옵션: --with-content (content/ 전부 포함) · --content=<slug>[,<slug>] (그 앱의 md만 포함, 새 앱 추가 때)
#         --seed-overrides (overrides.json 포함 — 처음 한 번, 또는 라이브 상태를 시드할 때만)
# 쓰는 법:  tools/make-zip.sh [출력경로] [옵션…]
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"; NAME="$(basename "$HERE")"; OUT="${1:-/tmp/$NAME.zip}"; shift || true
WITH_CONTENT=0; SEED=0; ONLY=""
for a in "$@"; do case "$a" in --with-content) WITH_CONTENT=1;; --seed-overrides) SEED=1;; --content=*) ONLY="${a#--content=}";; esac; done
python3 "$HERE/tools/stamp.py"
EX=(-x "*.DS_Store" -x "$NAME/media/*/works/*")
[ "$SEED" = 1 ] || EX+=(-x "$NAME/data/overrides.json")
[ "$WITH_CONTENT" = 1 ] || EX+=(-x "$NAME/content/*")
rm -f "$OUT"; (cd "$HERE/.." && zip -qr "$OUT" "$NAME" "${EX[@]}")
if [ -n "$ONLY" ] && [ "$WITH_CONTENT" = 0 ]; then IFS=, read -ra SL <<< "$ONLY"; for s in "${SL[@]}"; do (cd "$HERE/.." && zip -q "$OUT" "$NAME/content/$s.md"); done; fi
echo "zip → $OUT"; unzip -l "$OUT" | grep -E "content/|overrides|works/" || true; unzip -l "$OUT" | tail -1
