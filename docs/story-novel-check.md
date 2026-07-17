# 스토리/소설 번역 점검 지시서

## 목적

메인 스토리, 이벤트 스토리, 캐릭터 스토리, 홈 대사, 재생 팝업, 해방 조건, 스토리 요약의 일본어 노출을 방지한다.

캐릭터 관련 스토리는 `new-character-update.md`도 함께 보고, 스테이지에 연결된 이벤트 스토리는 `stage-content-check.md`도 함께 본다.

## 먼저 확인할 범위

- `translations/novels`: 본문 대사와 홈 대사
- `translations/titles`: 스토리/장/에피소드 제목
- `translations/descriptions`: 스토리 요약, 설명
- `translations/outgame`: 재생 확인, 해방 조건, 보상, 스토리 UI exact key

노벨 본문 캐시에는 일반 대사 `message,`뿐 아니라 월드 말풍선 대사 `dotmessage,`, 화면 중앙에 크게 뜨는 연출 문구 `messageTextCenter`, Live2D 대사 `l2dmessage`도 들어온다. 예: `<size=48>――シラエスが前線基地を訪れてから、１週間後</size>`, `l2dmessage,シラエス,よし――君はそのまま、私に身を委ねていればいいからな。,,vc_...`. 이런 문구는 `translations/novels/<NOVEL_ID>/ko_KR.json`에 key/value가 있어야 하며, outgame/description 쪽만 확인하면 누락된다.

특히 메인 스토리의 월드 말풍선은 `dotmessage,`로, H스토리/Live2D 연출은 본문 narration이 `message,`로, 캐릭터 음성 대사가 `l2dmessage,`로 분리될 수 있다. `dotmessage` 또는 `message`만 번역하면 다른 말풍선/발화가 일본어로 남는다. 신규 스토리 검수에서는 `message`, `dotmessage`, `messageTextCenter`, `l2dmessage` 4종을 모두 추출해 누락 0건인지 확인한다.

### `dotmessage` 전체 추출 규칙

- 런타임 로그에 수집된 말풍선 몇 개를 전체 대사로 간주하지 않는다. 로그의 `Runtime balloon audit` 항목은 플레이어가 실제로 진행한 장면의 표본일 뿐이며, 같은 스토리의 나머지 장면은 아직 로그에 없을 수 있다.
- 원본 TextAsset에서 `dotmessage,<speaker>,<text>,<balloon/voice metadata...>` 행을 모두 추출한다. `,,` 뒤의 음성/표정/위치/캐릭터 메타데이터는 번역 key에 넣지 않고 `<text>`만 key로 사용한다.
- `dotmessage` 개수와 `translations/novels/<NOVEL_ID>/ko_KR.json`의 해당 원문 key 개수를 직접 대조한다. 원문 대사 수보다 번역 key 수가 적으면 번역 완료로 보지 않는다.
- `dotmessage`에는 루디아, 마리나, 소피아, 주인공, 교주, 사제, 신도처럼 파일 ID와 다른 화자가 섞일 수 있다. `speaker`를 기준으로 character card, 호칭, 말투를 적용한다.
- `audit-cached-event-novels.mjs --all-cached --deep-small-textassets`와 `audit-novel-dialogue-metadata.mjs --all-cached --deep-small-textassets --write-index`가 `dotmessage`를 포함하는지 확인한 뒤 번역한다. 감사 결과가 `dotmessage`를 0개로 보고하면 스크립트 범위를 먼저 의심한다.
- 원본 전체 대조를 통과한 뒤에만 실제 스토리를 진행해 런타임 말풍선과 `outgame-ja_JP.json`을 추가 확인한다. 런타임 수집 4개, 10개 등 일부 항목만으로 완료 처리하지 않는다.

### 신규 잡몹/등장인물명 검수 규칙

- 스토리 TextAsset의 `message`, `dotmessage`, `l2dmessage` 두 번째 필드인 `speaker`를 전부 모아 `translations/names/ko_KR.json`과 대조한다. 이름이 대사에 한 번만 등장해도 이름 사전 누락으로 처리한다.
- 대사 화자와 별도로 `charaload,...,<name>` 및 `objectload,...,<name>`의 마지막 이름 필드도 확인한다. 씬에만 배치되는 인물이라도 이름판/전투 UI에 노출될 수 있으므로 신규 잡몹, 교단 간부, 병사, 제자, 주민 라벨을 누락시키지 않는다.
- `信者A`와 `信者Ａ`, `信者 C`와 `信者Ｃ`처럼 ASCII/전각 문자, 공백 유무가 다른 표기는 서로 다른 exact key로 취급하고 각각 등록한다.
- 신규 스토리의 이름 전수 대조 후 `translations/manifest/ko_KR.json`을 갱신하고 게임 로컬 `cache/ko_KR/names.json`에도 복사한다. 이름 사전만 수정하고 로컬 캐시를 갱신하지 않으면 화면에는 이전 일본어가 남을 수 있다.

캐릭터 호칭 규칙은 파일 ID만으로 판단하지 않는다. 원본 스크립트의 `message,<speaker>,...`, `l2dmessage,<speaker>,...`에서 화자 메타데이터를 함께 추출하고, 그 화자 기준으로 `character-cards.md`와 glossary를 적용한다. 예: 이벤트 본편 `evs_...`에 쿠레하가 등장하면 파일명이 `hmr_105801...`가 아니어도 `旦那様/旦那さま/旦那=서방님` 규칙을 적용한다. 마리나의 `旦那様=나리` 규칙을 다른 캐릭터에게 전파하지 않는다.

스토리 건너뛰기 확인 팝업의 긴 요약 본문은 일반 소설 본문(`translations/novels`)이 아니라 스토리 메타데이터 요약이다. 신규/변경 스토리에서는 같은 일본어 요약이 `translations/descriptions/ko_KR.json`와 `translations/outgame/ko_KR.json` 양쪽에 있어야 한다.

## 필수 확인 테이블

- `m_novel_mains`
- `m_novel_main_chapters`
- `m_novel_events`
- `m_novel_characters`
- `m_novel_character_skins`
- `m_novel_homes`
- `m_novel_others`
- `m_novel_prologues`
- `m_event_story_stages`

## Novel ID 확인

스토리 파일은 다음 접두어로 내려올 수 있다.

- `evs_...`: 이벤트/스토리
- `hmn_...`: 홈/캐릭터 계열
- `hmr_...`: 홈/캐릭터 계열
- `men_...`: 메뉴/홈/캐릭터 계열

`translations/novels/<NOVEL_ID>/ko_KR.json` 존재 여부만 보지 말고, 게임 캐시와 로그에서 실제 `NovelId`를 같이 확인한다.

캐릭터 홈/성인/창관 계열 스토리(`hmn_...`, `hmr_...`, `men_...`)는 작은 TextAsset 번들로 내려와 캐시 파일 헤더 검색에 안 잡히는 경우가 있다. `LogOutput.log`에 `NovelId:`가 찍혔는데 감사 결과가 `log-only-missing-file` 또는 `messages=0` 경고로만 남으면 끝낸 것이 아니다. 사용자가 해당 스토리를 실제로 열어 일본어가 보였다는 뜻이면, 게임 캐시의 작은 `__data` TextAsset fallback까지 스캔해서 원문 메시지를 찾아 `translations/novels/<NOVEL_ID>/ko_KR.json`을 만들어야 한다.

신규 캐릭터 또는 캐릭터 스토리 전체 재확인 때는 로그에 찍힌 ID만 보지 말고 `--deep-small-textassets`를 붙여 작은 TextAsset 전체를 훑는다. 이 모드는 헤더에 NovelId가 없는 글라디아/쿠레하/시라에스 계열 `hmn/hmr` 누락을 잡기 위한 필수 전수 검사다.

## 작업 순서

1. `.cache/game-cache-extract-report.json`의 `changes.added`, `changes.changed`, `changes.removed`에서 `m_novel_*`, `m_event_story_stages`를 확인한다.
2. `F:\DMMGamePlayer\dotabyss_x_cl\BepInEx\LogOutput.log`에서 `NovelId:`가 찍힌 경우 `evs/hmn/hmr/men` 전체를 확인한다.
3. `scripts\audit-cached-event-novels.mjs --all-cached`로 게임 캐시 TextAsset의 신규/누락 파일을 확인한다. 이 스크립트는 로그에만 잡힌 NovelId가 있으면 작은 TextAsset fallback도 확인해야 한다.
4. 신규 캐릭터/전체 캐릭터 스토리 재검수는 `scripts\audit-cached-event-novels.mjs --all-cached --deep-small-textassets`로 다시 돌린다. 이 결과가 `issues=0 warnings=0`이어야 캐릭터 스토리 본문 누락 확인이 끝난 것이다.
5. 신규 파일이 누락되면 `--write-missing-source`로 번역 대기 JSON을 만든 뒤 번역한다. `messages=0` 경고는 사용자 제보 스토리에서는 미완료로 본다.
6. `scripts\audit-character-story-ui.mjs --write-missing-source`로 신규 요약이 `descriptions`에도 들어갔는지 확인한다. 이 스크립트는 `outgame`에 이미 번역된 요약을 `descriptions` 누락분에 복사하고, 번역값이 없으면 원문을 seed한 뒤 감사에서 실패시킨다.
7. `value == key`, 일본어 가나 잔존, `,,vc_...`, `,,,chara_...` 꼬리표 잔존을 확인한다.
8. 중앙 연출 문구 `messageTextCenter`와 Live2D 대사 `l2dmessage`도 누락 0건인지 확인한다. 특히 이벤트 진입 직후의 `<size=48>――前線基地　研究所</size>` 같은 장소명과 `<size=48>――翌日</size>`, `<size=48>――数日後</size>` 같은 시간 전환은 일반 대사와 별도 key다. `.cache/novel-message-index.json`에서 `evs_* + messageTextCenter` 전체를 뽑아 각 `translations/novels/<NOVEL_ID>/ko_KR.json`과 exact-key로 대조한다. `messageTextCenter`의 `,,,on`/`,,,off`, `l2dmessage`의 `,,vc_...`, 끝의 `,,` 같은 표시/음성 꼬리표는 번역 key에 포함하지 않는다.
9. 대사 번역은 `translation/character-cards.md`, `translation/character-voice.md`, `translation/adult-content.md`, `translation/context-review.md`를 함께 확인한다.
10. `scripts\audit-novel-dialogue-metadata.mjs --all-cached --deep-small-textassets --write-index`로 원본 대사 화자 인덱스를 만들고, `speaker + source` 기준의 호칭/성인 용어 검수를 통과시킨다. 이 감사는 `message`, `dotmessage`, `messageTextCenter`, `l2dmessage`를 모두 보며, 쿠레하/마리나 `旦那様` 규칙과 `素股/スマタ/すまた=스마타` 규칙을 검사한다. 인덱스의 speaker 목록은 `names/ko_KR.json`과 별도로 대조한다.
11. `scripts\audit-runtime-balloons.mjs --fail-on-mixed`를 실행해 런타임 수집 파일의 말풍선 후보, 한국어+일본어 혼합 키, 미번역 exact key를 확인한다. 로그에 `NovelRoot/WorldUICanvas/.../Balloon`, `Exploration/.../TextBalloon`, `Popup_QuestSelect/.../InfoNovel/TextBalloon` 중 하나라도 나오면 해당 화면을 말풍선 QA 범위에 포함한다. 전체 신규 텍스트 완료 시에는 `--fail`까지 실행한다.
12. 한 캐릭터의 고유 호칭/별명은 한 파일만 고치지 말고 `translations/novels` 전체에서 같은 원문 호칭을 검색한다. 특히 캐릭터 계열 `hmn_...`, `hmr_...`, `men_...`이 서로 다른 파일에 흩어져 있으므로 일반/일상/H/홈 대사 전체를 함께 맞춘다. 예: 에메르다의 `特ダネさん`은 `특종 씨`로 통일하고 `특다네 씨`, `특종 기자님`, `특종님`처럼 흔들지 않는다.
13. 한 캐릭터 스토리에서 `missing-key`가 1개라도 나오면 같은 숫자 캐릭터 ID 전체를 재검수한다. 예를 들어 `hmn_10190100001`에서 키 누락이 나오면 `101901` 계열 `hmn_101901...`, `hmr_101901...`, `men_101901...` 전체를 캐시 원문 메시지와 번역 JSON key로 직접 대조해 `missing=0`, `untranslated=0`인지 확인한다. 원문 오탈자/수정본처럼 key가 한 글자만 다른 경우 기존 key를 지우지 말고 실제 런타임 key를 추가한다.
14. 줄바꿈은 `translation/style-core.md` 기준을 따른다. 현재 스토리 대사 기준은 표시 줄당 약 34자 목표, 36자 초과 시 수정이다. 36자는 대사 전체가 아니라 한 줄 기준이다. 줄이 길면 직역을 고집하지 말고 의미/말투를 유지한 채 자연스럽게 압축하거나 `<br>`을 자연스러운 한국어 구 단위에 넣는다. `조사<br>를`, `느<br>껴서`, `책임감<br>을`처럼 단어/조사/어미가 잘리는 줄바꿈은 실패로 본다. 원문 key에 `<br>`이 있으면 번역 value에도 같은 위치 또는 같은 문맥 분할로 `<br>`을 유지해 화면 줄바꿈이 사라지지 않게 한다.

## 런타임 exact key 주의

CDN outgame에 제목/요약 번역이 있어도 실제 화면은 조합된 exact key를 탈 수 있다. 다음 문구는 런타임 수집 파일에서 따로 확인한다.

- `再生しますか`
- `クリアで解放`
- `【n話】스토리제목\nを再生しますか？`
- `【n話】스토리제목をクリア`
- `初回報酬`
- 스토리 해방 팝업
- 재생 확인 팝업
- 스토리 요약 팝업

신규 이벤트 스토리에서는 제목 단독 key만 번역되어 있어도 재생 확인 팝업이 일본어로 남을 수 있다. 예를 들어 `【5話】おいでませ、鬼ヶ島リゾート！`가 번역되어 있어도 실제 팝업은 `【5話】おいでませ、鬼ヶ島リゾート！\nを再生しますか？`라는 별도 exact key를 사용한다. 새 `【n話】...` 제목을 추가하거나 발견하면 같은 제목에 대해 다음 outgame key를 함께 확인/생성한다.

```text
【n話】제목
【n話】제목\nを再生しますか？
【n話】제목をクリア
```

한 화만 고치지 않는다. 같은 이벤트의 6화, 7화, 8화처럼 아직 화면에 안 뜬 다음 화도 같은 패턴으로 빠져 있을 가능성이 높다. `translations/outgame/ko_KR.json`의 `【n話】` 제목 전체를 훑어 재생 확인/클리어 조건 조합 key가 없는지 확인한다.

진행도에 따라 제목만 바뀌는 공통 팝업은 고정 문구와 동적 제목이 따로 번역될 수 있다. 새 장을 실제로 진행한 뒤 `BepInEx/config/AbyssMod/outgame-ja_JP.json`에서 한국어와 일본어가 섞인 수집 key를 확인한다. 예를 들어 `大穴の探索が進み<br>「불타는 성벽 조사」<br>が周回可能になりました。`처럼 제목만 한국어이고 앞뒤가 일본어면 개별 제목 key만 추가하지 말고, 기존 DLL의 동적 템플릿 기능을 이용해 다음 공통 key를 등록한다.

```text
대상: 大穴の探索が進み<br>「{[quest]}」<br>が周回可能になりました。
결과: 어비스 탐색이 진행되어<br>「{[quest]}」<br>순회가 가능해졌습니다.
```

7장에서는 현재 확인된 조사 해금 팝업뿐 아니라, 이후 해금되는 모든 조사명에 같은 템플릿이 적용되는지 재진입/재시작으로 확인한다. 신규 장마다 `outgame-ja_JP.json`에 남은 한국어+일본어 혼합 key가 0건인지 확인한다.

퀘스트 선택 화면의 `Popup_QuestSelect/.../InfoNovel/TextBalloon`은 일반 `mas_` 본문 감사에 잡히지 않을 수 있다. 장면을 실제로 진행한 뒤 로그의 `NovelId`와 이 경로를 함께 확인하고, 말풍선 원문은 해당 `translations/novels/<NOVEL_ID>/ko_KR.json`과 `translations/outgame/ko_KR.json` 양쪽 exact key에 보강한다. 말풍선이 한국어로 바뀌지 않으면 노벨 파일 누락으로 단정하지 말고, 퀘스트 선택 UI의 outgame exact 경로도 같이 검사한다.

건너뛰기 요약 팝업은 노벨 화면 안에서 뜨기 때문에 전역 outgame 스캔만으로는 잡히지 않을 수 있다. 화면이 일본어면 먼저 `descriptions` 누락, 그다음 노벨 계층 TMP exact 번역 패치 적용 여부를 확인한다.

신규 스토리 요약 확인 필수 항목:

- `m_novel_characters` field 4
- `m_novel_character_skins` field 5
- `m_novel_mains` field 5
- `m_novel_others` field 5
- `m_novel_prologues` field 4

위 항목은 `translations/descriptions/ko_KR.json`에 존재해야 하며, 스토리 목록/상세/건너뛰기 확인 팝업에서 같은 요약이 쓰일 수 있으므로 `translations/outgame/ko_KR.json`에도 exact key가 있어야 한다.

## 검증

```powershell
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\validate-translations.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\review-novel-layout.mjs --changed --fail
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-cached-event-novels.mjs --all-cached
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-cached-event-novels.mjs --all-cached --deep-small-textassets
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-novel-dialogue-metadata.mjs --all-cached --deep-small-textassets --write-index
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-runtime-balloons.mjs --fail-on-mixed
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-character-story-ui.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-novel-location-titles.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\update-manifest.mjs
```

## 완료 기준

- 신규/변경 스토리 파일이 모두 `translations/novels`에 존재한다.
- 본문 value가 원문 그대로 남아 있지 않다.
- 가나/일본어 잔존과 음성 꼬리표 잔존이 0건이다.
- 루비 태그의 읽기/본문까지 검사해 `<ruby=きょうえい>鏡影</>` 같은 숨은 일본어 잔존이 0건이다. 한국어 독음이 불필요하면 루비 태그를 제거한다.
- 변경된 노벨은 고정 2줄 대화창 기준 줄당 목표 34자, 최대 36자이며 `<br>`은 최대 1개다. `review-novel-layout.mjs --changed --fail`이 `watch=0 autoReflow=0 manual=0`으로 통과한다.
- `messageTextCenter` 중앙 연출 문구의 `<size=48>...` key 누락과 일본어 잔존이 0건이다.
- H스토리/Live2D 스토리의 `l2dmessage` key 누락과 일본어 잔존이 0건이다.
- `audit-cached-event-novels --all-cached`가 `issues=0 warnings=0`이다. 특히 사용자 제보 NovelId가 `log-only-missing-file`로 남아 있으면 완료가 아니다.
- 신규 캐릭터/전체 캐릭터 재검수에서는 `audit-cached-event-novels --all-cached --deep-small-textassets`도 `issues=0 warnings=0`이다.
- 캐릭터 스토리의 특정 파일에서 key 누락이 발견되면 같은 숫자 캐릭터 ID의 `hmn/hmr/men` 전체가 `missing=0`, `untranslated=0`으로 확인되어 있다.
- 제목, 요약, 재생 확인, 해방 조건, 첫 보상 팝업이 한국어로 표시된다.
- 스토리 건너뛰기 확인 팝업의 긴 요약 본문이 한국어로 표시된다.
- `audit-character-story-ui`의 `missing-description`이 0건이다.
- `audit-runtime-balloons`가 런타임 말풍선 경로를 기록하고, 혼합 한국어+일본어 말풍선이 번역 사전에 남아 있지 않다.
- 캐릭터 말투와 호칭이 `character-cards.md` 기준과 충돌하지 않는다.
- 캐릭터 고유 호칭/별명이 `hmn/hmr/men` 전체에서 같은 기준으로 통일되어 있다.
- 원본 대사의 화자 메타데이터 기준으로 쿠레하 `旦那様=서방님`, 마리나 `旦那様=나리`가 분리 적용되어 있다.
- `素股`/`スマタ`/`すまた` 원문은 모두 `스마타`로 번역되어 있고 `스오마`, `소마타`, `스타마`, `겉치기`가 남아 있지 않다.
