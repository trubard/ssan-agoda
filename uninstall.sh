#!/bin/bash
# 아고다 가격 비교기 — Linux 제거
echo "▶ 아고다 가격 비교기 제거 (Linux)"
for BASE in /etc/opt/chrome /etc/chromium; do
  F="$BASE/policies/managed/ssan-agoda.json"
  [ -f "$F" ] && sudo rm -f "$F" && echo "  삭제: $F"
done
echo "크롬/크로미엄을 재시작하면 확장이 사라집니다."
