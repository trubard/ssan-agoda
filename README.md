# 아고다 가격 비교기 (크롬 확장프로그램)

아고다 숙소 페이지를 **여러 로케일(POS)로 자동 접속**해 가격을 수집하고 한 표에 정리합니다. 할인은 통화가 아니라 언어/POS로 걸리므로, 통화는 **KRW로 고정**하고 로케일만 바꿔 같은 통화로 직접 비교합니다. 모든 접속이 **사용자 본인 브라우저·IP**로 일어나므로 봇 차단을 거의 받지 않습니다.

## 동작 원리

**자동 모드(기본)**: 숙소 페이지에서 **국가를 감지**해, 그 나라의 현지 로케일·통화를 한국(ko-kr/KRW)·글로벌(en-us/USD) 기준선과 함께 자동으로 비교합니다. URL만 넣고 누르면 됩니다.

수동 모드(자동 체크 해제 시):

1. 아고다 호텔 URL을 파싱 (호텔/도시/날짜/인원 유지)
2. `로케일 × 통화` 변형 주소 생성
   - **기본 세트**: 각 로케일을 KRW로(사이트 버전별 가격 비교) + 기준 로케일을 각 통화로(통화별 비교)
   - **전체 조합**: 로케일 × 통화 전부
3. 백그라운드 탭에서 순서대로 열어 가격 추출 후 탭 닫기
4. 통화 고정(KRW)이라 환산 없이 가격 직접 비교, 최저가 하이라이트

## 설치 (개발자 모드 로드)

1. 크롬에서 `chrome://extensions` 접속
2. 우상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 저장소의 `extension/` 폴더 선택

## 자동 설치 (OS별 원클릭, 스토어 불필요)

크롬 정책(`ExtensionInstallForcelist`)에 등록 → 크롬 재시작 시 자동 설치 + 자동 업데이트.

| OS | 실행 파일 | 관리자 권한 | 제거 |
|----|-----------|-------------|------|
| macOS | `install.command` 더블클릭 | 불필요 | `uninstall.command` |
| Windows | `install.bat` 더블클릭 | 불필요(HKCU) | `uninstall.bat` |
| Linux | `bash install.sh` | 필요(sudo) | `bash uninstall.sh` |
| ChromeOS(일반) | 불가 — 관리형 기기만 Admin 콘솔로 가능 | — | — |

설치 후 **크롬을 완전히 종료했다가 다시 실행**하고, `chrome://policy`에서 `ExtensionInstallForcelist`에 `ggjogpplbgneanckpfgmdghmkhbddjon`이 보이면 성공입니다.

> 동작 원리: 정책이 `dist/update.xml`을 가리키고, 거기서 `dist/ssan-agoda.crx`를 받아 설치합니다. 확장 ID는 서명키로 고정됩니다.
> 한계: 크롬은 스토어 밖 설치를 OS 정책으로만 허용하므로 "모든 환경 단일 파일 원클릭"은 불가능합니다. 일반 ChromeOS는 자체 설치 자체가 막혀 있습니다. 진짜 범용 원클릭이 필요하면 크롬 웹스토어(비공개 등록)뿐입니다.
> 다운로드해 실행할 경우 OS 보안경고(Gatekeeper/SmartScreen)가 뜰 수 있어, 우클릭→열기 등으로 한 번 허용해야 합니다.

## 사용

1. 아고다 호텔 상세 페이지(날짜·인원이 들어간 URL)를 연 상태로 확장 아이콘 클릭
   - 또는 팝업에 URL 직접 붙여넣기
2. **새 창에서 분석** 클릭 → 별도 창이 열리며 수집·결과 표시
   - 팝업은 닫혀도 되고, 수집은 새 창에서 계속됩니다(포커스 잃어도 중단 안 됨)
   - 결과는 한 건씩 실시간으로 표에 채워지고, 최저가가 ✅ 표시됩니다

## 알려진 한계 / 튜닝 포인트

- **가격 선택자**: 아고다 DOM 구조가 바뀌면 가격을 못 읽을 수 있습니다. `extension/results.js`의 `scrapePrice()` 안 `selectors` 배열을 실제 페이지 기준으로 조정하세요. (현재 `cheapest-room-price-property-nav-bar` 선택자 + JSON-LD 폴백)
- **쿠키 초기화(중요)**: 아고다는 저장된 언어/통화 선호를 쿠키로 기억해 URL 파라미터를 덮어씁니다. 그래서 각 접속·링크 클릭 전에 `agoda.com` 쿠키를 모두 삭제합니다. 이 때문에 **아고다 로그인/선호 설정이 풀릴 수 있습니다**(정상 동작).
- **통화 표기**: 모든 변형에 `currencyCode=KRW`를 강제합니다. 혹시 아고다가 특정 로케일에서 통화를 바꿔 표시하면, 그 행은 다른 통화라 최저가 비교에서 제외됩니다(표의 통화 컬럼으로 확인 가능).
- **IP 기반 차이**: 결제단계 환율/수수료 등 *실제 IP 위치*로 갈리는 부분은 로케일 변경으로 재현되지 않습니다.
- **개인 비교 용도**: 요청을 천천히(기본 1.2초 간격) 보냅니다. 아고다 ToS를 고려해 과도한 반복 수집은 피하세요.

## 새 버전 배포 (개발자용)

코드 수정 후 자동 업데이트를 내보내려면:

1. `extension/manifest.json`의 `version` 올리기 (예: `0.1.0` → `0.1.1`)
2. crx 다시 패키징 (같은 `key.pem` 사용 — ID 유지):
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --user-data-dir=/tmp/crxpack --no-message-box \
     --pack-extension="$PWD/extension" --pack-extension-key="$PWD/key.pem"
   mv -f extension.crx dist/ssan-agoda.crx
   ```
3. `dist/update.xml`의 `version`을 manifest와 동일하게 수정
4. `git commit && git push` → 설치된 크롬들이 수 시간 내 자동 업데이트

> ⚠️ `key.pem`은 절대 공개하지 마세요(`.gitignore`로 제외됨). 분실하면 ID가 바뀌어 기존 설치의 자동 업데이트가 끊깁니다.
>
> 참고: 크롬 확장은 정적 자산이라 Vercel에 "앱"으로 배포할 대상은 아닙니다.
