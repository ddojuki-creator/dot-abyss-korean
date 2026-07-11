# 신규 캐릭터 번역 반영 작업 지시서

## 목적

게임 업데이트로 신규 캐릭터가 추가되었을 때 이름, 어빌리티, 스태프 등록 안내, 한계돌파 강화 설명을 한국어 CDN에 안전하게 반영한다.

## 핵심 원칙

1. JSON key는 일본어 원문 그대로 유지하고 value만 한국어로 작성한다.
2. 일본어 캐릭터명은 `translations/names/ko_KR.json`과 `translations/outgame/ko_KR.json` 양쪽에 등록한다.
3. 신규 어빌리티명은 `translations/outgame/ko_KR.json`에 독립 key로 등록한다.
4. `<br>`, `<color>`, TMP 태그와 특수기호를 변경하지 않는다.
5. CDN 변경은 항상 `main` 브랜치에 commit/push한다.
6. `旦那様`, `お兄さん`, `ご主人様`처럼 여러 캐릭터가 공유하는 호칭은 기존 캐릭터 규칙을 그대로 덮어쓰지 말고, 신규 캐릭터의 프로필/스토리 문맥으로 별도 고정한다. 예: 마리나 `旦那様=나리`, 쿠레하 `旦那様=서방님`.

## 2026-07-10 업데이트 기준

- 필수 신규 캐릭터: `リエラ=리에라`, `アイシャ=아이샤`.
- 보완 캐릭터 카드: `ルシータ=루시타`.
- `グラディア=글라디아`, `クレハ=쿠레하`, `シラエス=시라에스`는 기존 상세 카드를 유지한다.
- 리에라는 소악마 갸루풍의 장난기를 살리되 베리사식 메스가키/`허접` 조롱 캐릭터로 만들지 않는다.
- 아이샤는 마족 소환사의 자신감과 `사역`, `소환`, `인간 관찰` 어휘를 살리되 과한 여왕님/악역 말투로 만들지 않는다.
- 루시타는 바다, 로망, 선장, 동료애를 중심으로 하며 거친 해적 욕설이나 과한 남성화를 피한다.
- 캐릭터 카드는 화자 메타데이터가 확인된 스토리 대사에만 적용한다. UI, 스킬, 어빌리티, 시스템 문구에는 glossary의 이름/칭호/전투 용어만 적용한다.

클라이언트 추출 필수 순서:

1. 최신 `DownloadCache/*.dat`에서 MasterData 스냅샷을 갱신한다.
2. 업데이트 시각 이후 Unity 캐시의 TextAsset을 `--cache-since`로 추출하되, 메인 스토리 `mas_`는 접두사 뒤 숫자가 10자리이고 캐릭터/이벤트 스토리는 보통 11자리이므로 두 형식을 모두 검사한다. 신규 `mas_`, `evs_`, `hmn_`, `hmr_`, `men_` 노벨을 찾는다.
3. 신규 장을 실제로 한 번 열어 시나리오 ID가 로그에 기록된 뒤에는 `--cache-since` 검사만으로 끝내지 말고 전체 캐시 검사도 실행한다. 기존 캐시 파일이 재사용되면 본문 `__data`의 수정 시각이 업데이트 시각보다 오래될 수 있다.
4. `audit-novel-dialogue-metadata.mjs --write-index`로 화자 메타데이터를 만든 뒤 캐릭터 카드를 적용한다. 메인 스토리 음성 메타데이터는 `mcv_`, 캐릭터/이벤트 음성은 `vc_`일 수 있으므로 둘 다 제거·검수한다.
5. 런타임 `outgame-ja_JP.json`을 병합해 클라이언트 추출 밖의 동적 UI 문자열을 보강한다.

## 수집 화면

신규 캐릭터마다 아래 화면을 각각 한 번 표시한 뒤, 게임을 종료하고 `BepInEx/config/AbyssMod/outgame-ja_JP.json`에서 실제 원문을 확인한다.

- 캐릭터 획득 또는 이름 노출 화면
- 캐릭터 상세의 이름, 이명, 속성, 역할, 프로필 설명
- 스태프 등록 팝업
- 스태프 활동 가능 연출
- 신규 어빌리티 해금 팝업
- 한계 돌파 내용 화면
- 강화 효과 확인 팝업
- 스킬 / 어빌리티 상세 정보 화면
- 스킬 / 어빌리티 상세 정보 화면 오른쪽의 `어빌리티 강화` 카드 전체
- 어빌리티 각성 화면의 한계돌파 단계별 카드
- 등급 상승 전/후 스킬 설명
- 등급 상승 전/후 어빌리티 설명
- 각성 효과가 붙은 스킬/어빌리티 설명
- 신규 캐릭터 일상/만남/개인 스토리 대사

## 이름과 어빌리티명 등록

`translations/names/ko_KR.json`:

```json
"クロエ": "클로에"
```

`translations/outgame/ko_KR.json`:

```json
"クロエ": "클로에",
"推し活パワー！": "응원 파워!"
```

완성된 스태프 등록/어빌리티 해금 문장은 원칙적으로 개별 등록하지 않는다. 기존 동적 템플릿이 캐릭터명과 어빌리티명을 조합한다.

## 신규 캐릭터 전체 파일 확인

신규 캐릭터는 이름과 어빌리티만 추가하면 안 된다. 아래 파일군에서 같은 캐릭터명이 들어간 신규 key를 모두 확인한다.

- `translations/names/ko_KR.json`: 캐릭터명, `<娼館>` 이름, 소환수/동행자 이름
- `translations/titles/ko_KR.json`: 일상/캐릭터 에피소드/이벤트 제목
- `translations/descriptions/ko_KR.json`: 캐릭터 소개, 에피소드 설명, 상품/패키지 설명
- `translations/outgame/ko_KR.json`: 캐릭터명, 스킬명, 어빌리티명, 팝업, 강화 설명, 공지/상점/아이템 문구
- `translations/novels/<id>/ko_KR.json`: 신규 캐릭터 일상, 만남, 창관, 이벤트 스토리 대사
- `translations/another_name/ko_KR.json`: 이명/별칭이 추가된 경우

특히 신규 캐릭터의 `men_`, `hmn_`, `hmr_`뿐 아니라 메인 스토리의 `mas_`와 이벤트의 `evs_` 소설 파일이 추가되면 CDN에 번역이 있어도 게임 로컬 캐시에 해당 `novels/<id>.json`이 없으면 불러오기 실패 또는 일본어 원문 fallback이 발생할 수 있다. `mas_1001070101`처럼 메인 스토리 ID는 10자리 숫자 형식이므로 일반 11자리 노벨 정규식에 의존하지 않는다. 신규 장/이벤트 반영 후에는 manifest의 novels 수와 게임 로컬 캐시의 novels 파일 수/해시를 반드시 확인한다.

## 한계돌파 강화 문구 확인

신규 캐릭터는 등급 상승에 따라 스킬과 어빌리티 성능 설명이 바뀔 수 있다. 캐릭터별로 변경 전/변경 후 설명을 모두 확인한다.

확인 대상:

- `스킬 레벨 업` 영역의 강화 후 스킬 설명
- `어빌리티 강화` 영역의 강화 후 어빌리티 설명
- 어빌리티 등급 상승 전/후 설명과 스크롤로 가려진 하단 설명
- `【覚醒効果】`가 붙은 전체 설명
- `<color=#...>` 태그가 포함된 수치 강조 설명
- `m_ability_details`의 본문 필드와 각성 효과 필드가 합쳐져 화면에 나온 전체 설명
- 숫자 치환 완료 후 `<color=#4CF37B>`가 들어간 런타임 exact key
- `스킬 & 어빌리티 상세` 오른쪽 `어빌리티 강화` 카드의 이름, 본문, 발동 조건, 효과, 각성 효과
- `紋章`, `状態異常`, `クエスト中1回まで`, `バトル開始時`가 포함된 복합 설명

등록 원칙:

1. `outgame-ja_JP.json`에 수집된 실제 원문을 그대로 key로 사용한다.
2. 단독 문장만 등록하지 말고, `【覚醒効果】`까지 붙은 전체 문장이 있으면 전체 문장도 등록한다.
3. 같은 구조에서 수치만 바뀌는 문장은 `{value}`, `{rate}`, `{duration}`, `{count}` 등 동적 템플릿으로 추가한다.
4. 동적 템플릿이 이미 있어도 게임 런타임이 숫자와 색상 태그를 합친 exact key를 만들 수 있으므로, 실제 화면에서 일본어가 보인 문장은 `BepInEx/config/AbyssMod/outgame-ja_JP.json`에 수집된 exact key도 추가한다.
5. `<br>`와 `<color>` 태그 위치는 원문과 동일하게 유지한다.
6. 한 캐릭터에서 발견된 패턴은 다른 캐릭터의 등급 상승 설명에도 재사용되는지 검색한다.
7. 화면 하나가 한국어로 보여도 끝내지 말고, 강화 전/후, MAX, 각성, 한계돌파, 상세 팝업의 별도 key를 모두 확인한다.
8. `キャノン コール`/`カノンコール`, 반각 `&`/전각 `＆`처럼 공백/전각/반각 차이가 있으면 실제 수집 key와 스크린샷 표기를 모두 등록한다.
9. `自身の攻撃力と防御力と最大HP`와 `自身の攻撃力と防御力、最大HP`처럼 조사/쉼표 차이만 있는 런타임 변형도 별도 key로 등록한다.
10. 화면에는 줄바꿈으로만 보이더라도 실제 key는 `<br><color=#D7DEF8>【覚醒効果】</color>`를 포함할 수 있다. 태그 포함 key와 화면에 보이는 `\n【覚醒効果】` key를 모두 확인한다.
11. `outgame-ja_JP.json`에 한국어와 일본어가 섞인 key가 수집되면 정상 번역이 일부만 먼저 적용된 상태다. 한국어가 섞였다고 제외하지 말고, 남은 일본어가 있는지 확인한 뒤 전체 key를 한국어 value로 등록한다.
12. `outgame-ja_JP.json`에 `ã€`, `ã`, `ãƒ`, `ç™`, `è¦`, `æ”`, `é˜` 같은 깨진 문자열이 보이면 수집 인코딩이 깨진 것이다. 스크린샷과 masterdata를 기준으로 정상 일본어 key를 복원해 등록하고, 깨진 key만 보고 완료 처리하지 않는다.

예시:

```json
"自身が付与する状態異常の確率が【15%】上昇<br><color=#D7DEF8>【覚醒効果】</color>自身の受けるダメージが【<color=#4CF37B>9.5%</color>】減少": "자신이 부여하는 상태 이상 확률이【15%】상승<br><color=#D7DEF8>【각성 효과】</color>자신이 받는 피해가【<color=#4CF37B>9.5%</color>】감소"
```

## 스토리/소설 대사 확인

신규 캐릭터 스토리는 UI와 별도 경로다. 이름이 한국어로 보여도 대사 번역이 적용됐다고 판단하면 안 된다.

필수 확인:

1. 신규 캐릭터명이 들어간 `translations/novels/**/ko_KR.json` 파일을 검색한다.
2. 해당 소설 value 안에 히라가나/가타카나/일본어 한자 조각이 남아 있는지 확인한다.
3. `translations/manifest/ko_KR.json`의 `novels`에 신규 소설 ID가 포함됐는지 확인한다.
4. 게임 로컬 캐시를 갱신할 때 `cache/ko_KR/novels/<id>.json`도 같이 반영됐는지 확인한다.
5. 스샷에서 대사가 일본어로 나오면 먼저 CDN 누락보다 로컬 `novels` 캐시 누락을 의심한다.
6. `scripts\audit-cached-event-novels.mjs --all-cached --deep-small-textassets`로 전체 캐시를 검사하고, `scripts\audit-novel-dialogue-metadata.mjs --all-cached --deep-small-textassets --write-index --write-missing-source`로 `message`, `dotmessage`, `messageTextCenter`, `l2dmessage` 원문과 화자 메타데이터를 추출하면서 누락된 `mas_` 원문 파일과 키를 먼저 생성한다. 런타임 로그에 수집된 말풍선은 전체 대사의 표본일 뿐이므로, 원본 `dotmessage` 전체 키 수와 번역 JSON 키 수를 별도로 대조한다. 메인 스토리 ID와 `mcv_` 음성 메타데이터가 감사 결과에 포함되는지 확인한 뒤, 번역 후에는 `--write-missing-source` 없이 재검사한다.
7. 화자 기준 호칭/용어 검수를 통과시킨다. 이벤트 본편 `evs_...`나 메인 본편 `mas_...`에 캐릭터가 등장해도 파일 ID가 캐릭터 ID로 시작하지 않을 수 있으므로, `message,<speaker>,...`, `dotmessage,<speaker>,...`, `l2dmessage,<speaker>,...`의 speaker를 기준으로 character card를 적용한다.
8. 새 장을 실제로 진행한 뒤 `BepInEx/config/AbyssMod/outgame-ja_JP.json`의 수집 결과에서 한국어+일본어 혼합 key를 검색한다. 진행도 팝업처럼 제목만 동적으로 바뀌는 문구는 개별 exact key를 반복 추가하지 말고 `{[quest]}` 동적 템플릿으로 등록한다. 예: `大穴の探索が進み<br>「{[quest]}」<br>が周回可能になりました。`.
9. `Popup_QuestSelect/.../InfoNovel/TextBalloon`에 표시되는 장면 말풍선은 일반 노벨 감사에서 빠질 수 있으므로, 실제 진행 후 `NovelId`별 소설 JSON과 outgame exact 사전을 모두 확인한다.

로컬 캐시 수동 반영이 필요한 경우 repo 구조와 게임 캐시 구조가 다르다.

```text
repo: translations/novels/<id>/ko_KR.json
game: BepInEx/plugins/AbyssMod/cache/ko_KR/novels/<id>.json
```

## 검증과 반영

```powershell
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\update-manifest.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\validate-translations.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-character-abilities.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-character-ability-upgrade-matrix.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-limit-break-ability-combos.mjs --all
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-novel-location-titles.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-runtime-balloons.mjs --fail-on-mixed
git add translations/names/ko_KR.json translations/outgame/ko_KR.json translations/manifest/ko_KR.json docs/new-character-update.md
git commit -m "Update new character translation guide"
git push origin main
```

검증 항목:

- JSON 파싱 성공
- 캐릭터명과 어빌리티명 value가 한국어인지 확인
- 신규 캐릭터 관련 `names`, `titles`, `descriptions`, `outgame`, `novels`, `another_name` key 누락이 없는지 확인
- 신규 캐릭터의 주인공 호칭이 기존 캐릭터 호칭 규칙과 충돌하지 않는지 확인한다. 특히 `旦那様`/`旦那さま`/`旦那`처럼 같은 원문이 캐릭터별로 다른 번역을 요구할 수 있다.
- 캐릭터 호칭 검수는 파일명만 보지 않고 원본 대사의 speaker 메타데이터를 기준으로 한다. 예: 쿠레하가 `evs_...` 이벤트 본편에서 말하는 `旦那様`도 `서방님`으로 고정한다.
- `ドリンク`는 `음료`가 아니라 `드링크`로 번역했는지 확인
- `<br>`와 색상 태그 보존
- 한계돌파 강화 설명의 `【覚醒効果】`, 수치, 색상 태그 보존
- `m_ability_details`와 런타임 exact key의 한계돌파/각성 설명 일본어 잔존 0건
- `스킬 & 어빌리티 상세` 오른쪽 `어빌리티 강화` 카드의 `バトル開始時`, `発動条件`, `効果`, `覚醒効果` 일본어 잔존 0건
- 한국어가 섞인 runtime key와 mojibake key를 정상 일본어/한국어 기준으로 다시 확인
- `scripts\audit-character-abilities.mjs` 통과
- `translations/novels/**/ko_KR.json` value 안에 일본어 잔존이 없는지 확인
- 게임 로컬 캐시의 `cache\ko_KR\novels`가 manifest의 신규 소설을 모두 포함하는지 확인
- `translations/manifest/ko_KR.json` 갱신 확인

## 문제 발생 시 확인 순서

1. 캐릭터명 일본어: 이름 key가 names/outgame 양쪽에 있는지 확인한다.
2. 어빌리티명 일본어: 어빌리티명 독립 key가 outgame에 있는지 확인한다.
3. 한계돌파 강화 설명 일본어: `outgame-ja_JP.json`에 수집된 전체 문장이 outgame 번역에 있는지 확인한다.
4. 어빌리티 등급 상승 후 일본어: `scripts\audit-character-abilities.mjs`를 실행해 누락/일본어 잔존을 확인한다.
5. 스토리 대사 일본어: `translations/novels/<id>/ko_KR.json`에 번역이 있는지, 게임 캐시 `cache\ko_KR\novels\<id>.json`에 복사됐는지 확인한다.
6. 재시작 후에도 일본어: 실제 문장이 기존 템플릿과 같은지 비교한다.
7. 태그 또는 색상 오류: 원문의 `<color>` 범위와 템플릿 토큰 위치를 확인한다.
8. CDN 미반영: manifest hash와 `main` 브랜치 push 여부를 확인한다.

## 완료 기준

- 신규 캐릭터 이름이 모든 UI에서 한국어로 표시됨
- 스태프 등록 팝업과 활동 가능 연출이 한국어로 표시됨
- 신규 어빌리티 해금 팝업의 캐릭터명과 어빌리티명이 모두 한국어로 표시됨
- 한계돌파 화면의 강화 전/후 스킬/어빌리티 설명이 모두 한국어로 표시됨
- 스킬 / 어빌리티 상세 정보 화면의 스킬명, 어빌리티명, 각성 효과, 강화 어빌리티 설명이 모두 한국어로 표시됨
- 신규 캐릭터 일상/만남/개인 스토리 대사가 모두 한국어로 표시됨
- CDN 번역과 게임 로컬 캐시의 신규 `novels` 파일이 누락 없이 일치함
- 신규 캐릭터 때문에 DLL을 별도로 수정하지 않아도 됨
