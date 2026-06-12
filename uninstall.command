#!/bin/bash
# 아고다 가격 비교기 — 제거 (강제설치 정책에서 이 확장만 빼고 나머지는 보존)

ID="ggjogpplbgneanckpfgmdghmkhbddjon"

echo "▶ 아고다 가격 비교기 제거"
echo ""

/usr/bin/python3 - "$ID" <<'PY'
import subprocess, sys, re
ID = sys.argv[1]
try:
    out = subprocess.check_output(
        ["defaults", "read", "com.google.Chrome", "ExtensionInstallForcelist"],
        stderr=subprocess.DEVNULL).decode()
except subprocess.CalledProcessError:
    print("  등록된 정책이 없습니다."); sys.exit(0)

entries = re.findall(r'"([^"]+)"', out)
keep = [e for e in entries if not e.startswith(ID)]
subprocess.run(["defaults", "delete", "com.google.Chrome", "ExtensionInstallForcelist"],
               stderr=subprocess.DEVNULL)
for e in keep:
    subprocess.run(["defaults", "write", "com.google.Chrome",
                    "ExtensionInstallForcelist", "-array-add", e])
print(f"  제거 완료 (다른 강제설치 {len(keep)}개는 보존).")
PY

echo ""
echo "크롬을 재시작하면 확장이 사라집니다."
read -r -p "엔터를 누르면 창이 닫힙니다… " _
