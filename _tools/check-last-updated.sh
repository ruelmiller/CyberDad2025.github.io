#!/usr/bin/env bash
# R2: run on the BUILT site after the merge build. Fails (exit 1) if the merge-date sentinel or the old
# bracketed date marker is still anywhere in the built HTML, or if /terms-of-sale/ or /refund-policy/
# does not show "Last updated: <Month> <d>, <yyyy>". The mailing-address placeholder is not checked here.
# Usage: bash _tools/check-last-updated.sh [_site]
site=${1:-_site}; rc=0
hits=$(grep -rlE 'SET-AT-MERGE|LAST UPDATED DATE – PENDING RUEL' --include='*.html' "$site" 2>/dev/null)
if [ -n "$hits" ]; then echo "FAIL: last-updated sentinel/marker still in the built site:"; echo "$hits" | sed 's/^/  /'; rc=1; fi
for p in terms-of-sale/index.html refund-policy/index.html; do
  if [ ! -f "$site/$p" ]; then echo "FAIL: $site/$p not built"; rc=1; continue; fi
  d=$(grep -oE 'Last updated: [A-Z][a-z]+ [0-9]{1,2}, [0-9]{4}' "$site/$p" | head -1)
  if [ -n "$d" ]; then echo "ok: /${p%index.html} $d"; else echo "FAIL: /${p%index.html} has no 'Last updated: <Month> <d>, <yyyy>'"; rc=1; fi
done
[ $rc -eq 0 ] && echo "PASS: last-updated dates set" || echo "check-last-updated: FAILED"
exit $rc
