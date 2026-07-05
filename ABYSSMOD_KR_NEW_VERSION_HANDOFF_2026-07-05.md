# AbyssMod KR 신버전 최신 작업 지시서

기준 시각: 2026-07-05 KST

이 문서는 새 Codex 대화에서 AbyssMod 한국어판 신버전 작업을 바로 이어받기 위한 최신 지시서다.  
기존 최초 지시서를 대체하기보다는, 2026-07-05 오전까지의 실제 적용 상태와 주의사항을 덧붙인 최신 인수인계 문서로 사용한다.

## 최초 지시서

먼저 아래 원본 지시서를 읽고, 이 문서의 최신 상태를 우선 적용한다.

```text
C:\Users\tl300\Documents\Codex\2026-06-17\new-chat\ABYSSMOD_KR_NEW_VERSION_MASTERDATA_HANDOFF.md
```

## 프로젝트 정체

작업 대상은 AbyssMod 한국어판 신버전이다.

핵심 구조는 다음 하이브리드 방식이다.

```text
MasterData/static = 스킬, 어빌리티, 장비, 캐릭터, 퀘스트 등 원천 데이터 번역 메인 층
outgame          = 버튼, 탭, 팝업, 런타임 조합 문자열, mixed UI 보정 층
novels           = 노벨 본문 전용 번역 층
```

중요한 원칙:

- 중국어 upstream 최신본으로 한국어판 전체를 덮어쓰지 않는다.
- `TranslationPatch.cs`, `OutGameTranslation.cs`의 한국어판 전용 보강을 보존한다.
- `outgame`을 끄지 않는다. 신버전은 `static` 메인 + `outgame` 보조 구조다.
- CDN은 `test`가 아니라 반드시 `main` 브랜치를 쓴다.
- `translations/manifest/ko_KR.json`은 직접 수동 편집하지 않고 `scripts/update-manifest.mjs`로 갱신한다.

## 주요 경로

최신 작업 레포:

```text
C:\Users\tl300\Documents\Codex\2026-07-04\build-a-fresh-full-bepinex-rc\work\dot-abyss-korean-main-newversion
```

중국어 upstream 참고본:

```text
C:\Users\tl300\Documents\Codex\2026-06-17\AbyssMod-main
```

한국어판 구버전 소스 참고본:

```text
C:\Users\tl300\Documents\Codex\2026-06-17\new-chat\work\AbyssMod-main
```

DLL 분석/디컴파일 참고:

```text
C:\Users\tl300\Documents\Codex\2026-07-04\build-a-fresh-full-bepinex-rc\analysis-dll
```

게임 설치 플러그인:

```text
F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\plugins\AbyssMod\AbyssMod.dll
```

게임 설정:

```text
F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\config\AbyssMod.cfg
```

로컬 outgame 적용 파일:

```text
F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\config\AbyssMod\outgame-ko_KR.json
```

로컬 캐시:

```text
F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\plugins\AbyssMod\cache\ko_KR
```

## 현재 CDN 상태

레포:

```text
https://github.com/ddojuki-creator/dot-abyss-korean.git
```

브랜치:

```text
main
```

최신 확인 커밋:

```text
c225872 Add event buff and mixed UI translations
```

최근 주요 커밋:

```text
c225872 Add event buff and mixed UI translations
a5297fb Fix fist weapon loading tip translation
52aea09 Add mixed reward UI dynamic translations
45f68a3 Add ability reward dynamic translations
6df278c Add satisfaction label dynamic translation
70abb05 Add research detail UI translations
d8075b2 Add split skill effect translations
b139a3a Add event card effect translations
52220d1 Add story unlock dynamic translation
0d2a2df Add abyss code swap target prompt
8e17319 Add abyss code swap UI translations
b66e314 Shorten mystery key counter label
```

작업 레포 상태는 2026-07-05 기준 깨끗했다.

```powershell
git status --short --branch
# ## main...origin/main
```

## 현재 설치 DLL 상태

2026-07-05 오전 09:43경 노벨 스킵 팝업 번역 보강 DLL이 실제 게임 폴더에 적용되었다.

설치된 DLL:

```text
F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\plugins\AbyssMod\AbyssMod.dll
```

SHA256:

```text
98CAC4E2BC3156212889AE09865879BC7284052A1CCDECAEF8175250900F2FB0
```

주의:

- 2026-07-04 작업 폴더의 `outputs\AbyssMod-newversion.dll`은 SHA256이 `8DF246BA2CE91360F516C51930FA28C66782C750547205B0A0829CD72533D91D`였다.
- 이 파일은 현재 설치된 `98CAC...` DLL보다 오래된 산출물일 수 있다.
- 새 작업자가 게임 폴더의 DLL을 `outputs\AbyssMod-newversion.dll`로 덮어쓰면 노벨 스킵 팝업 보강이 사라질 수 있다.
- DLL을 교체해야 할 때는 반드시 현재 설치 DLL을 백업하고, 새 빌드 산출물의 변경 내용을 확인한 뒤 교체한다.

## 2026-07-05 오전 추가 DLL 보강

증상:

- 노벨 화면 안의 스킵 확인 팝업에서 다음 공용 UI 문구가 일본어로 남았다.

```text
ストーリーをスキップします。
セリフウィンドウ長押しで高速表示となります。
キャンセル
決定
```

확인:

- 위 문구들은 이미 번역 파일에 있었다.
- 원인은 사전 누락이 아니라, 팝업이 노벨 화면 안에 떠서 노벨 본문 보호 로직 때문에 주기 번역 스캔에서 제외되던 점이었다.

적용한 방향:

- 노벨 내부라도 완전일치 공용 UI 문구만 번역되도록 좁게 허용했다.
- 노벨 본문/연출 텍스트를 건드리는 동적 outgame 번역은 계속 차단한다.
- 이 보강이 빠지면 노벨 스킵 팝업이 다시 일본어로 남을 수 있다.

현재 설치 DLL 해시:

```text
98CAC4E2BC3156212889AE09865879BC7284052A1CCDECAEF8175250900F2FB0
```

## 2026-07-05 오전 CDN/outgame 추가 보강

아래 변경들은 CDN `main`, 로컬 적용 파일, 로컬 캐시에 반영했다. 최신 커밋은 `c225872`다.

추가/수정된 대표 항목:

```text
イベント効果 -> 이벤트 효과
編成バフ情報 -> 편성 버프 정보
編成バフ一覧 -> 편성 버프 목록
編成バフ効果 -> 편성 버프 효과
効果発動中 -> 효과 발동 중
スコア状況 -> 스코어 현황
記録なし -> 기록 없음
特別依頼クエスト1をクリア -> 특별 의뢰 퀘스트1 클리어
特別依頼クエスト{[num]}をクリア -> 특별 의뢰 퀘스트{[num]} 클리어
{[from]} ~ {[to]}まで -> {[from]} ~ {[to]}까지
```

이벤트 효과 설명문:

```text
クエストごとに紋章：情熱の付与など、様々な効果が発生します。（内容はクエスト詳細で確認できます。）
-> 퀘스트마다 문장: 열정 부여 등 다양한 효과가 발생합니다. (내용은 퀘스트 상세에서 확인할 수 있습니다.)
```

용어 통일:

```text
문장：정열 -> 문장：열정
중급【정열】버프 -> 중급【열정】버프
```

mixed UI exact 보강:

```text
「대장장이」のアップグレードが完了し、以下のボーナスを獲得しました。
「사령본부」のアップグレードが完了し、以下のボーナスを獲得しました。
研究効果：드롭률 상승
研究効果：심연 전 수송 기능 해방
研究効果：어비스 코드 리롤 횟수+1
研究効果：어비스 코드 소지 한도 증가
研究効果：연구 포인트 배율 상승
研究効果：체크포인트 해방(10층)
研究効果：초기 어비스 코인 증가
ストーリー解放：「가슴(특수 마도로)이 두근거립니다」が解放！
ストーリー解放：「결전의 땅으로……!」が解放！
ストーリー解放：「고장 났을지도 몰라요」が解放！
ストーリー解放：「귀여움이 지나쳐!」が解放！
ストーリー解放：「깨어나는 여검사」が解放！
ストーリー解放：「라베리아의 진심」が解放！
ストーリー解放：「뭐든지 할 수 있는 누나?」が解放！
ストーリー解放：「여검사 vs 초절륜객」が解放！
ストーリー解放：「웬디와 마법사들」が解放！
ストーリー解放：「웬디의 불길 속 활약」が解放！
ストーリー解放：「웬디의 새로운 직장」が解放！
ストーリー解放：「제가 상대해 드릴게요」が解放！
```

이 mixed exact 보강은 동적 규칙이 있어도 감사 스크립트가 런타임 수집 샘플 exact key를 요구하는 경우를 통과시키기 위한 것이다.

## 로컬 적용/캐시 동기화

CDN 변경 뒤, 다음 세 파일이 같은 내용으로 맞춰져 있었다.

```text
translations\outgame\ko_KR.json
F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\config\AbyssMod\outgame-ko_KR.json
F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\plugins\AbyssMod\cache\ko_KR\outgame.json
```

또한 manifest도 다음 두 파일이 같은 내용으로 맞춰져 있었다.

```text
translations\manifest\ko_KR.json
F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\plugins\AbyssMod\cache\ko_KR\manifest.json
```

CDN만 갱신했는데 게임에서 바로 확인해야 하면, 레포 파일을 위 로컬 파일/캐시에 복사하면 된다.  
다만 장기적으로는 CDN `main`에 push하고 게임 재시작 또는 캐시 갱신으로 받는 흐름을 기본으로 한다.

## 현재 검증 통과 기준

2026-07-05 기준 아래 검증이 통과했다.

```powershell
node scripts\validate-translations.mjs
node scripts\audit-outgame-critical.mjs
node scripts\audit-outgame-ui-hotspots.mjs
node scripts\audit-static-bundle.mjs
node scripts\audit-masterdata-coverage.mjs
node scripts\audit-character-abilities.mjs
node scripts\audit-character-ability-upgrade-matrix.mjs
node scripts\audit-limit-break-ability-combos.mjs --all
```

기대 결과:

```text
validate-translations: parseErrors=0, tokenErrors=0
audit-outgame-critical: issues=0
audit-outgame-ui-hotspots: missing=0, untranslated=0, japanese-leftover=0
audit-static-bundle: static bundle audit ok
audit-masterdata-coverage: missingCandidates=0
audit-character-abilities: issues=0
audit-character-ability-upgrade-matrix: issues=0
audit-limit-break-ability-combos --all: issues=0
```

`audit-masterdata-coverage`의 `coverage warnings`는 결제 상품 ID, asset id, 내부 options 등 번역 대상이 아닌 필드일 수 있다. `missingCandidates=0`이면 우선 통과로 본다.

Node가 PATH에 없으면 Codex 번들 Node를 사용한다. 2026-07-05 환경에서는 다음 경로가 유효했다.

```text
C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
```

예:

```powershell
& 'C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts\validate-translations.mjs
```

## MasterData/static 작업 원칙

신버전의 핵심은 중국어 upstream 최신 구조를 한국어판에 맞게 이식한 것이다.

필수 유지 항목:

- `MasterMapping.cs`
- `MasterDataPatch.cs`
- `Config/master.json`
- `Manifest.cs`의 `[JsonExtensionData]` 및 `GetFileHash(type)`
- `TranslationPaths`의 `static`, `ui_texts` 포함
- `TranslationCache`의 캐시/해시 개선, stale fallback, resource별 lock
- `TranslationManager`의 `_tables`, `_flatTables`, static bundle API
- 네트워크 요청 타임아웃 60초
- CDN 기본 URL은 `main` 브랜치

한국어판 전용 보강도 반드시 유지한다.

- 아웃게임 exact translation
- `message`, `messageTextCenter`, `l2dmessage` 스토리 번역
- 노벨 단일 일본어 글자 outgame 치환 방지
- 한국어 폰트 적용/보정
- 버튼 중앙 정렬
- 코스튬 카드 라벨 정렬
- 장비 설명 스크롤바 여백
- 스킬/어빌리티 설명 레이아웃 보정
- 이미지 교체 패치
- 한계돌파/어빌리티 조합 exact key 대응
- `OutGameTranslation.cs`의 Composite UI translation fallback
- F8 번역 OFF 시 reverse restore 보강
- 노벨 텍스트 계층/색상 보정
- 노벨 내부 공용 UI exact 번역 허용 보강

## static bundle 생성/갱신

static 번들 생성:

```powershell
node scripts\build-static-bundle.mjs
```

manifest 갱신:

```powershell
node scripts\update-manifest.mjs
```

정상 목표:

```text
translations/static/ko_KR.missing.json == {}
audit-static-bundle 통과
audit-masterdata-coverage missingCandidates=0
```

static 생성 시 주의:

- value가 없으면 원문 그대로 대량 seed하지 않는다.
- `--write-missing-source`는 임시 seed가 정말 필요할 때만 쓴다.
- `문장: 열정`은 static에서 `<color=#FF5050>문장: 열정</color>` 표기가 기본이다.
- `문장: 충격`은 static에서 `<color=#6B8CFF>문장: 충격</color>` 표기가 기본이다.
- `m_transition_tips`의 `武器：拳`은 `무기: 권`으로 유지한다.
- 권 무기 설명은 로딩 화면에서 잘리지 않도록 줄바꿈 유지가 필요하다.

## outgame 작업 원칙

outgame은 삭제하거나 축소하지 않는다. 다음 유형은 계속 outgame 대상이다.

- 버튼, 탭, 팝업 고정 문구
- 런타임에서 색상 태그/수치/이름을 조합한 최종 문장
- MasterData/static으로 일부만 번역되어 생기는 mixed 문자열
- 노벨 밖 UI 문구
- 노벨 내부 공용 UI exact 문구

mixed UI에서 자주 생기는 형태:

```text
研究効果：{한국어 효과명}
ストーリー解放：「{한국어 제목}」が解放！
「{한국어 시설명}」のアップグレードが完了し、以下のボーナスを獲得しました。
「{한국어 어빌리티명}」の最大Lvが10に上昇！
{한국어 장소명}の満足度
```

동적 규칙만으로 실제 런타임 감사가 통과하지 않는 경우가 있다. 이때는 수집된 exact key도 추가한다.

## 이미지로 박힌 일본어

다음처럼 배너 이미지 안에 박힌 일본어는 outgame 텍스트 번역으로 해결되지 않는다.

```text
お願い司令官！レイゼリアからの特別依頼
```

이 유형은 이미지 교체 작업이 필요하다.

2026-07-05 확인 시점:

- `replacements.json`이 비어 있었다.
- 이미지 교체가 필요하면 원본 이미지 식별, 한국어 이미지 제작, replacements 설정, 실제 게임 화면 검증을 별도 작업으로 진행한다.

## PC 설정 확인

`F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\config\AbyssMod.cfg`에서 다음을 확인한다.

```ini
[Translation]
Enabled = true
CDN = https://raw.githubusercontent.com/ddojuki-creator/dot-abyss-korean/refs/heads/main/translations
Language = ko_KR

[Translation.OutGame]
Enabled = true
```

DLL 로직만 바뀐 경우 캐시 강제 갱신이 필수는 아니다.  
CDN 번역 데이터만 바뀐 경우 화면 재진입/게임 재시작으로 충분할 때도 있지만, 캐시가 안 바뀌면 로컬 캐시를 백업 이동하거나 새 파일을 직접 복사한다.

캐시는 삭제보다 백업 이동을 권장한다.

```text
F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\plugins\AbyssMod\cache
F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\plugins\AbyssMod\cache.bak-YYYYMMDD-HHMMSS
```

## DLL 교체 절차

게임이 실행 중이면 DLL이 잠길 수 있다. 강제로 덮어쓰지 않는다.

권장 절차:

1. 게임 종료.
2. 현재 DLL 백업.
3. 새 빌드 산출물 복사.
4. 대상 DLL SHA256 확인.
5. 게임 실행 후 로그와 화면 확인.

현재 최신 설치 DLL은 다음 해시다.

```text
98CAC4E2BC3156212889AE09865879BC7284052A1CCDECAEF8175250900F2FB0
```

이 해시보다 오래된 산출물로 덮어쓰지 않는다.

## 런타임 확인 우선순위

게임 실행 후 우선 확인할 화면:

```text
노벨 스킵 확인 팝업
이벤트 효과 / 특별 의뢰 이벤트 화면
편성 버프 정보 / 편성 버프 목록 / 편성 버프 효과 화면
강화 효과 확인 팝업
어빌리티 강화 카드
캐릭터 인연 보상 목록
연구 상세 UI
탐험/명계 이벤트 카드 선택지와 하단 효과 줄
문장: 열정 / 문장: 충격 색상
한계돌파 어빌리티 3단계 비교 화면
장비/마나젬/인챈트 설명
노벨 본문과 선택지
```

정상 로그 기대:

```text
[MasterMapping] loaded ... tables
Static translation bundle loaded. Tables: ..., Total: ...
Composite UI translation ...
```

`Composite UI translation`은 mixed 문자열 fallback이 동작한 경우 찍힐 수 있다.

## 새 일본어 제보 처리 절차

사용자가 화면 스크린샷이나 일본어 문구를 주면 다음 순서로 확인한다.

1. 텍스트인지 이미지인지 구분한다.
2. 텍스트라면 `translations/outgame/ko_KR.json`, `static/ko_KR.json`, flat 파일에서 기존 key를 검색한다.
3. 이미 번역 파일에 있으면 DLL 스캔 제외, 노벨 보호 로직, 캐시, 화면 재진입 문제를 의심한다.
4. 사전 누락이면 `outgame` 또는 적절한 원본 번역 파일에 추가한다.
5. MasterData 원천 텍스트면 원본 번역 파일 보강 후 `build-static-bundle.mjs`를 다시 실행한다.
6. `update-manifest.mjs` 실행.
7. 검증 스크립트 실행.
8. 로컬 적용 파일/캐시를 맞춘다.
9. `main` 브랜치에 커밋/푸시한다.

커밋 전 최소 검증:

```powershell
node scripts\validate-translations.mjs
node scripts\audit-outgame-critical.mjs
node scripts\audit-outgame-ui-hotspots.mjs
node scripts\audit-static-bundle.mjs
```

MasterData/static을 건드렸으면 추가로:

```powershell
node scripts\audit-masterdata-coverage.mjs
node scripts\audit-character-abilities.mjs
node scripts\audit-character-ability-upgrade-matrix.mjs
node scripts\audit-limit-break-ability-combos.mjs --all
```

## 절대 하지 말 것

- 한국어판 전체를 중국어 upstream 최신본으로 덮어쓰기.
- `TranslationPatch.cs` 통째 교체.
- `OutGameTranslation.cs`의 합성 문자열 fallback 삭제.
- 기존 한국어 UI/폰트/레이아웃/이미지 보정 삭제.
- `novels` 구조 삭제.
- CDN `test` 브랜치에 신버전 결과 푸시.
- `manifest/ko_KR.json` 수동 편집.
- key를 한국어로 바꾸기.
- value가 미번역인데 원문 그대로 대량 seed하기.
- outgame을 완전히 끄고 static만으로 충분하다고 가정하기.
- 현재 설치 DLL `98CAC...`을 오래된 `outputs\AbyssMod-newversion.dll`로 덮어쓰기.

## 다음 대화 시작 시 권장 첫 확인

새 Codex 대화에서 바로 이어받을 때는 아래를 먼저 확인한다.

```powershell
cd C:\Users\tl300\Documents\Codex\2026-07-04\build-a-fresh-full-bepinex-rc\work\dot-abyss-korean-main-newversion
git status --short --branch
git log --oneline -5
Get-FileHash -Algorithm SHA256 -LiteralPath 'F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\plugins\AbyssMod\AbyssMod.dll'
```

정상 기준:

```text
git status: main...origin/main, dirty 없음
최신 커밋: c225872 Add event buff and mixed UI translations
DLL SHA256: 98CAC4E2BC3156212889AE09865879BC7284052A1CCDECAEF8175250900F2FB0
```

