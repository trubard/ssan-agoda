#!/bin/bash
# 아고다 가격 비교기 — macOS 자동 설치
# 크롬 정책(ExtensionInstallForcelist)에 등록하면, 크롬 재시작 시 자동으로
# 설치되고 이후 자동 업데이트됩니다. (관리자 권한 불필요)

ID="ggjogpplbgneanckpfgmdghmkhbddjon"
UPDATE_URL="https://raw.githubusercontent.com/trubard/ssan-agoda/main/dist/update.xml"
ENTRY="$ID;$UPDATE_URL"

echo "▶ 아고다 가격 비교기 설치"
echo ""

if defaults read com.google.Chrome ExtensionInstallForcelist 2>/dev/null | grep -q "$ID"; then
  echo "  이미 등록되어 있습니다."
else
  defaults write com.google.Chrome ExtensionInstallForcelist -array-add "$ENTRY"
  echo "  크롬 정책에 등록했습니다."
fi

echo ""
echo "✅ 다음 단계:"
echo "   1) 크롬을 완전히 종료(⌘Q)했다가 다시 실행하세요."
echo "   2) chrome://policy 를 열어 'ExtensionInstallForcelist' 항목에"
echo "      $ID 가 보이면 성공입니다."
echo "      (안 보이면 '정책 새로고침' 버튼을 누르고 크롬을 재시작하세요.)"
echo ""
read -r -p "엔터를 누르면 창이 닫힙니다… " _
