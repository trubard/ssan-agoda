#!/bin/bash
# 아고다 가격 비교기 — Linux 자동 설치 (관리형 정책, sudo 필요)
ID="ggjogpplbgneanckpfgmdghmkhbddjon"
URL="https://raw.githubusercontent.com/trubard/ssan-agoda/main/dist/update.xml"
ENTRY="$ID;$URL"
JSON="{\"ExtensionInstallForcelist\":[\"$ENTRY\"]}"

echo "▶ 아고다 가격 비교기 설치 (Linux)"
echo "  (관리형 정책 디렉터리에 써야 하므로 sudo가 필요합니다)"

wrote=0
for BASE in /etc/opt/chrome /etc/chromium; do   # Chrome / Chromium 둘 다 대응
  DIR="$BASE/policies/managed"
  if sudo mkdir -p "$DIR" 2>/dev/null; then
    echo "$JSON" | sudo tee "$DIR/ssan-agoda.json" >/dev/null && {
      echo "  등록: $DIR/ssan-agoda.json"; wrote=1; }
  fi
done

if [ "$wrote" = 1 ]; then
  echo ""
  echo "✅ 크롬/크로미엄을 완전히 종료 후 다시 실행하세요."
  echo "   chrome://policy 에서 $ID 가 보이면 성공입니다."
else
  echo "  설치 실패 — 정책 디렉터리에 쓸 수 없습니다."
fi
