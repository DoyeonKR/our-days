#!/usr/bin/env bash
# 굽기(계보 전부) → 코드 생성 → src/lib/pixellineage.ts 조립.
#   사용법: bash scripts/lineage-art/build.sh [계보키…]   (키를 주면 그 계보만 PNG 로 다시 굽는다 — 표(gen.mjs)는 항상 out/*.json 전부로 만든다)
#   Node 20 이면 SIMLIB 가 필요하다(deps.mjs 머리 주석). 결과를 저장소에 쓰지 않고 보려면 OUT=<파일> 을 준다.
set -e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="${OUT:-$ROOT/src/lib/pixellineage.ts}"
cd "$HERE"
mkdir -p out
if [ $# -gt 0 ]; then
  KEYS=("$@")
else
  KEYS=()
  for f in lineages/*.mjs; do b="${f#lineages/}"; KEYS+=("${b%.mjs}"); done
fi
for k in "${KEYS[@]}"; do timeout 90 node run.mjs "$k" 8 | head -1; done
timeout 60 node all.mjs 6 4 >/dev/null
node gen.mjs > "$OUT"
echo "assembled: $(wc -l < "$OUT") lines → $OUT"
