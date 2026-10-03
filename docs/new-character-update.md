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
- 캐릭터 카드는 실제 화자 메타데이터·인물/스킨 참조가 확인된 스토리·획득·스킨·이벤트 대사에 적용한다. UI에 표시되는 캐릭터 대사도 화자의 말투를 따르며, 버튼·스킬·어빌리티·시스템 문구에는 glossary의 이름/칭호/전투 용어만 적용한다.

## 2026-07-17 업데이트 기준

- 필수 신규 캐릭터: `フィオナ=피오나`, `クリスティ=크리스티`.
- 복합 화자명 `クリスティ・<user>`는 `크리스티・<user>`로 고정한다.
- 피오나의 정령 이름은 원문 철자별로 `ポパパポパ=포파파포파`, `ポパポパパ=포파포파파`, `パポプピパ=파포푸피파`, `パパポパパ=파파포파파`, `プピパピプ=푸피파피푸`, `ポポポポポ=포포포포포`로 구분한다. 일부는 다른 화자의 고의적인 오기이므로 진짜 이름으로 합치지 않는다.
- 피오나는 원문의 어린 존댓말과 `あるじさま=주인님`을 유지하되, 기계 번역이 쉼표를 음절 사이에 추가해 한국어 문장을 깨뜨리지 않게 검수한다.
- 크리스티는 차분한 존댓말과 `司令官さん=사령관씨`를 유지하고, 점괘/점성술/별의 인도 용어를 통일한다.
- 신규 이벤트 `evs_10300010101`, `evs_10300010201`과 캐릭터 `hmn_1056*`, `hmr_1056*`, `hmn_1072*`, `hmr_1072*`를 화자 메타데이터와 함께 전수 검사한다.
- `message`, `messageTextCenter`, `dotmessage`, `l2dmessage` 네 명령을 모두 비교하고, 업데이트로 같은 장면에 교정 원문이 추가되어 기존 철자 변형 key와 새 key가 동시에 존재하는지도 확인한다.

## 2026-07-24 코토노 업데이트 기준

- 필수 신규 캐릭터: `コトノ=코토노`.
- 지역명 `ホウライ`는 `호라이`로 고정하고 `호우라이`를 사용하지 않는다.
- 코토노 화자의 충성 맹세 전 `<user>殿`은 `<user>공`으로 번역한다.
- 코토노 화자의 충성 맹세 후 `旦那様`/`旦那`는 `주군`으로 번역한다. `나리`, `서방님`, `주인님`, `남편님`을 사용하지 않는다.
- `主君`도 `주군`으로 통일한다.
- `氷河の厄災=빙하의 재앙`, `飢餓の厄災=기아의 재앙`으로 구분한다. 두 재앙명을 서로 바꾸지 않는다.
- 코토노 문맥의 `サラシ`는 `가슴을 감는 천`처럼 의미가 드러나게 번역한다. `복대`나 음차 표기를 사용하지 않는다.
- 말투는 충직하고 단정한 사무라이풍 존댓말을 사용하되, 모든 문장을 과장된 사극체로 만들지 않는다.
- 아래 16개 시나리오는 이번 업데이트의 고정 회귀 검증 목록이다.

```text
hmn_10110100001
hmn_10110100002
hmn_10110100003
hmr_10110100011
hmr_10110100012
hmr_10110100013
hmr_10110100021
hmr_10110100022
hmr_10110100023
hmr_10110100031
hmr_10110100032
hmr_10110100033
men_10110100001
men_10110100002
men_10110100003
evs_10600010101
```

## 2026-07-31 수영복 캐릭터 업데이트 기준

- 필수 신규 캐릭터: `【水着】クルル=【수영복】쿠루루`, `【水着】ニナ=【수영복】니나`.
- 의상 접두사 `【水着】`는 한국어 표시명에서도 전각 꺾쇠괄호를 유지해 `【수영복】`으로 번역한다.
- 접두사 뒤에는 공백을 넣지 않는다. `[수영복] 쿠루루`, `[수영복]쿠루루`, `【수영복】 쿠루루` 같은 표기는 사용하지 않는다.
- 의상 버전은 별도 인물이 아니므로 기본 캐릭터 카드의 말투, 1인칭, 주인공 호칭을 그대로 상속한다.
- 이름 사전뿐 아니라 `names`, `outgame`, `static`, 스킬/어빌리티 상세, 획득 연출, 스토리 화자명에서 동일한 표시명을 확인한다.
- 이번 업데이트의 신규 `evs_1020003*`, `hmn_1109*`, `hmr_1109*`, `men_1109*`, `hmn_1120*`, `hmr_1120*`, `men_1120*`, `hmr_1021010011*`를 화자 메타데이터와 함께 전수 검사한다.

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

신규·변경 캐릭터는 이름과 어빌리티만 추가하면 안 된다. 최신 MasterData의 실제 캐릭터 ID와 참조 관계로 프로필·스킨·스토리 범위를 고정하고 아래 파일군을 모두 확인한다. 캐릭터명 문자열 검색은 보조 확인이며, 이름이 없는 이명·프로필·제목·줄거리를 검사 범위에서 제외하지 않는다.

- `translations/names/ko_KR.json`: 캐릭터명, `<娼館>` 이름, 소환수/동행자 이름
- `translations/titles/ko_KR.json`: 일상/캐릭터 에피소드/이벤트 제목
- `translations/descriptions/ko_KR.json`: 캐릭터 소개, 에피소드 설명, 상품/패키지 설명
- `translations/outgame/ko_KR.json`: 캐릭터명, 스킬명, 어빌리티명, 팝업, 강화 설명, 공지/상점/아이템 문구
- `translations/novels/<id>/ko_KR.json`: 신규 캐릭터 일상, 만남, 창관, 이벤트 스토리 대사
- `translations/another_name/ko_KR.json`: 모든 대상 캐릭터의 실제 이명/별칭 필드를 필수 확인

신규·변경 스토리의 목록 제목과 줄거리도 본문과 별도로 확인한다. 실제 스토리 참조와 메타데이터 row에서 원문을 추출해 `titles`·`descriptions`·`outgame`·해당 `static` 필드를 대조하고, 재생 확인·건너뛰기 등 실제 수집된 팝업 문구까지 확인한다. 캐릭터명 검색 결과나 본문 번역 완료만으로 제목·줄거리·주변 팝업까지 완료로 처리하지 않는다.

### 가챠 획득 대사 필수 확인

신규 캐릭터와 기존 캐릭터의 코스튬·스킨 추가/변경 때는 **가챠 획득 화면의 캐릭터 대사를 별도 필수 항목**으로 확인한다. 이름·프로필·스킬·스토리 본문 번역은 획득 대사 번역과 설치 적용을 대신하지 않는다.

1. 최신 원시 MasterData의 실제 캐릭터→스킨 참조로 대상 스킨을 전부 목록화한다. 기본/표시/작업용 스킨, 미획득·아직 화면에 나오지 않은 스킨도 확인하고, 캐릭터명 없는 대사를 제외하지 않는다. row ID·인물/asset 참조·대사 원문·위치·입력 버전/해시를 기록한다. ID 숫자 형태만으로 연결을 추정하거나 snapshot에 없는 빈 필드를 임의 확정하지 않는다.
2. `m_character_skins.serif`의 실제 필드를 확인한다. 현재 snapshot 위치는 `m_character_skins/id:<스킨ID>/6`이며, 매핑이 바뀌면 원시 row와 클라이언트를 다시 대조한다. 이름/설명인 필드 `4`/`5`와 구별하고, 동일 대사가 다른 홈/연출 표에 연결되면 그 실제 필드도 대조한다. `m_gacha_group_movies`의 소개/스킬 문구를 획득 대사로 대신하지 않는다. 빈 원문·테스트 값·미확정 연결은 근거와 함께 별도 기록한다.
3. 비어 있지 않은 획득 대사를 정확한 원문 key로 `translations/outgame/ko_KR.json`과 `static.m_character_skins.serif`에서 확인한다. 화자 카드·승인된 이름과 호칭을 적용하고 원문과 최종 저장값을 재독한다. 누락·빈 값·원문 그대로·일본어 잔존·의미 누락/추가는 미완료다. 원문의 LF·태그·변수를 보존하고, 실제 수집 key나 구현으로 확인한 변형만 등록한다. 기존 유효한 번역의 복사는 신규 번역으로 세지 않는다.
4. `node scripts/audit-outgame-critical.mjs`를 실행하고 대상 스킨 인벤토리와 대조한다. 이 감사의 스킨 범위는 snapshot의 실제 필드 `6`이며 `--added-only`는 전체 대상 스킨 확인을 대신하지 않는다. 원시 row의 숫자 참조·빈 필드·화자·의미·설치 사전·화면은 이 도구의 인증 범위 밖이다. 원문 위치 수·고유 원문 수·static 복제 수를 따로 기록하며, 생성기가 같은 대사를 이름/설명 필드에도 복제한 키 수를 실제 획득 대사 수로 세지 않는다. 다른 표의 기존 오류와 대상 스킨 검사 결과를 구분한다.
5. 설치 DLL의 실제 조회 순서와 각 exact key의 최종 선택값을 대조한다. 상위 사전의 빈 값·원문·오역도 하위 로컬 번역을 가릴 수 있다. 저장소/static에 번역이 있어도 설치 사전에 없으면 적용 완료가 아니다. 로컬 보완은 게임 종료·기존 사전 백업을 확인한 뒤 검수한 키만 기존값을 보존하여 병합하며, 게임 CDN 캐시/manifest 전체를 덮어쓰지 않는다.
6. 의미 검수·기술 검사·manifest·설치 선택값·로그 로드·실제 획득 화면·CDN 게시를 따로 기록한다. 획득 화면에서 일본어 잔존·잘림·겹침을 확인한 범위만 화면 완료로 보고한다. 수집 로그에 없는 대사는 원시 자료와 실제 화면 연결 근거를 기록하며, 미관측 화면·미게시 상태를 사전 존재나 다른 화면의 한국어 표시로 완료 처리하지 않는다.

### 교류 스토리 제목·요약 필수 확인

캐릭터 신규 추가와 기존 캐릭터의 코스튬·교류 회차 추가/변경 때는 **교류 스토리의 제목과 요약을 본문과 별도의 필수 작업**으로 처리한다. 이름·이명·스킬·본문만 번역하고 캐릭터 추가 작업을 마감하지 않는다.

1. 최신 MasterData의 실제 캐릭터·스킨·스토리 참조로 대상 교류 회차를 전부 목록화한다. `m_novel_characters`와 `m_novel_character_skins`, 연결된 만남·일상 등 관련 스토리 표의 실제 `title`·`description` 필드를 확인한다. 원문에 캐릭터명이 없거나 아직 잠긴 회차·미열람 회차도 제외하지 않는다. row ID·실제 본편 NovelId·원문 위치·제목·요약·입력 버전/해시를 고정하며, 썸네일용 ID를 본편 ID로 대신하지 않는다.
2. 각 회차의 제목은 `translations/titles/ko_KR.json`와 `outgame`, 요약은 `translations/descriptions/ko_KR.json`와 `outgame`에 정확한 원문 key로 등록하고, 해당 `static` 표의 실제 `title`·`description` 필드도 대조한다. 본문 JSON에는 제목·요약이 없을 수 있으므로 `novels` 파일 존재/번역만으로 이 검사를 대신하지 않는다.
3. 모든 대상 제목·요약을 원문과 저장값으로 따로 재독한다. 누락·빈 값·`value == source`·일본어 잔존·의미 누락/추가는 미완료다. 기존 유효한 번역의 복사는 신규 번역 실적으로 세지 않는다. 실제 빈 원문·원문 문제·개별 보류는 근거와 상태를 따로 남기고 독립적으로 처리 가능한 나머지 제목·요약을 완료한다.
4. [스토리 점검 지시서](story-novel-check.md)의 메타데이터·재생/건너뛰기 팝업 절차를 수행하고 `node scripts/audit-character-story-ui.mjs`를 실행한다. 이 감사는 전체 지원 범위를 검사하며 캐릭터 ID로 선택하지 않는다. 현재 `titles` 사전 전체를 검사하지 않고 `m_novel_homes`·`m_novel_events`·`m_novel_main_chapters`도 자동 범위 밖이므로, 도구 통과와 별도로 대상 회차의 원문 목록·각 필드/사전 저장값을 전수 대조한다. 다른 범위의 잔여 오류/보류는 구분한다. `--write-missing-source`로 만든 원문 대기값이나 사전 복사는 의미 검수 완료가 아니다.
5. 저장·의미 검수·기술 검사·manifest·게임 적용·CDN 게시·실화면 상태를 분리한다. 적용 범위의 제목·요약이 게임의 실제 조회 경로에서 올바른 값으로 선택되는지 확인하고, 교류 목록/상세의 제목과 **건너뛰기 확인 팝업의 요약 본문**을 직접 확인한다. 제목이 들어가는 재생 확인 팝업과 혼합 일본어 exact key도 점검한다. 미확인 화면·미게시·개별 보류가 있으면 그 범위를 기록하고 교류 제목·요약 전체 완료로 확대하지 않는다.

### 이명·프로필 원문 전수 대조

신규 캐릭터와 기존 캐릭터의 변경·코스튬 추가에 공통 적용한다. 이름이 한국어로 보이거나 수집 로그에 이명이 아직 없다는 이유로 이 절을 생략하지 않는다.

1. 최신 원시 MasterData의 `m_characters`·`m_character_profiles`·`m_character_skins` 참조 관계로 대상 캐릭터 ID, 프로필 ID, 스킨 ID를 확인한다. ID의 숫자 형태나 캐릭터명 검색만으로 연결을 추정하지 않는다. 원시 row와 추출 스냅샷의 버전·해시, 실제 표/row/필드 위치, 원문을 작업 기록에 고정한다.
2. `m_character_profiles`의 `flavor_text`(소개), `another_name`(이명), `profile_like`(좋아하는 것), `profile_dislike`(싫어하는 것), `catchphrase`(대표 대사)를 모두 확인한다. 현재 추출 위치는 각각 필드 `2`, `3`, `4`, `5`, `7`이며, 게임 매핑이 바뀌면 실제 row와 설치 DLL 매핑을 다시 대조한다. 스킨의 이름·설명·대사와 별도 프로필 참조도 확인한다. 스냅샷에 위치가 없다는 사실만으로 빈 원문으로 판정하지 않는다.
3. 비어 있지 않은 원문은 이름 포함 여부와 무관하게 전부 원문·저장값을 대조한다. 이명은 `another_name`와 `outgame`, 나머지 프로필 문구는 `descriptions`와 `outgame`에 등록하고, `static.m_character_profiles`의 **실제 해당 필드**에도 동일한 의미가 반영됐는지 확인한다. 누락·빈 값·`value == source`·가나 또는 혼합 일본어 잔존·사전 간 오역 충돌은 미완료로 기록한다. 태그·변수와 유효한 기존 번역은 보존한다.
4. 원문 위치 수와 고유 원문 수를 따로 집계한다. `build-static-bundle.mjs`가 같은 표의 원문을 여러 활성 필드에 복제한 산출 키 수나, 표/필드가 비어 있지 않다는 검사 결과를 실제 프로필 원문 전수 검사로 대신하지 않는다. 아래 정본 검사로 대상 프로필의 실제 필드 위치를 대조한다. 이 검사는 원시 row의 빈 필드나 캐릭터→프로필 연결을 인증하지 않으므로 1~2번의 원시 자료 확인도 남긴다.

   ```powershell
   node scripts/audit-character-profile-coverage.mjs --profile-ids <프로필ID1,프로필ID2> --json-out <검사기록.json>
   # 로컬 적용 뒤: --game-root에는 게임의 BepInEx 디렉터리를 지정한다.
   node scripts/audit-character-profile-coverage.mjs --profile-ids <프로필ID1,프로필ID2> --game-root <BepInEx경로> --require-game --json-out <적용검사기록.json>
   ```

5. 빈 원문은 원시 row 근거와 함께 해당 없음으로 기록한다. 테스트용 자리표시자·불명확한 약어는 원문 문제 또는 미확정으로 따로 남기고 실제 이명·설정을 지어내지 않는다. 개별 미확정 항목은 독립적으로 확인 가능한 나머지 필드의 작업을 막지 않는다.
6. 저장소에 번역이 있는 상태와 게임에 적용된 상태를 구분한다. 설치 DLL의 실제 UI 조회 순서와 `static` 매핑을 확인하고, 게임 캐시 및 지속 로컬 사전의 **해당 exact key와 최종 선택값**을 대조한다. `another_name` 파일 등록만으로 실행 적용을 주장하지 않는다. 로컬 보완은 기존 사전 백업·보존 후 검수한 키만 병합하며, 상위 사전의 원문/오역 값이 로컬 값을 가리는지도 확인한다. 로컬 반영을 위해 게임 CDN 캐시·manifest 전체를 덮어쓰지 않는다. 의미 검수·기술 검사·manifest·로컬 로드·CDN 게시·실화면을 따로 기록하고, 캐릭터 상세 화면에서 이름 위 이명과 프로필 본문·좋아함·싫어함·대표 대사, 관련 획득/스킨 화면의 일본어 잔존·잘림·겹침을 확인한 범위만 화면 완료로 보고한다.

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
13. 상세 카드가 본문과 각성 효과를 별도 `Text`로 렌더링할 수 있으므로 결합 exact key 통과만으로 완료 처리하지 않는다. `m_ability_details` 필드 4와 5 각각에 대해 `{20秒}` 같은 placeholder 원문, 중괄호가 제거된 `20秒` 런타임 원문, 초록/노란 `<color>` 수치 변형을 모두 확인한다.
14. `스킬 & 어빌리티 상세` 오른쪽 카드에서 기본 효과가 일본어이고 각성 효과만 한국어인 혼합 노출은 기본 효과 단독 런타임 key 누락으로 판정한다. `scripts/sync-limit-break-ability-combos.mjs`로 단독/결합 변형을 생성한 뒤 `scripts/audit-limit-break-ability-combos.mjs --all`이 0건인지 확인한다.

예시:

```json
"自身が付与する状態異常の確率が【15%】上昇<br><color=#D7DEF8>【覚醒効果】</color>自身の受けるダメージが【<color=#4CF37B>9.5%</color>】減少": "자신이 부여하는 상태 이상 확률이【15%】상승<br><color=#D7DEF8>【각성 효과】</color>자신이 받는 피해가【<color=#4CF37B>9.5%</color>】감소"
```

## 스토리/소설 대사 확인

신규 캐릭터 스토리는 UI와 별도 경로다. 이름이 한국어로 보여도 대사 번역이 적용됐다고 판단하면 안 된다.

### 시나리오 ID 인벤토리 게이트

업데이트 번역을 시작하기 전에 최신 전체 캐시에서 새로 추가되거나 변경된 `mas_`, `evs_`, `hmn_`, `hmr_`, `men_` ID 목록을 파일로 고정한다. 제목, 개요, 캐릭터 이름, outgame key가 번역되어 있어도 본문 시나리오가 존재한다는 증거로 사용하지 않는다.

각 신규/변경 ID는 아래 네 집합에 모두 존재해야 한다.

1. 전체 게임 캐시에서 추출한 원본 시나리오 ID
2. `translations/novels/<id>/ko_KR.json`
3. `translations/manifest/ko_KR.json`의 `novels`
4. 게임 로컬 `cache/ko_KR/novels/<id>.json`

네 집합 중 하나라도 빠지면 매니페스트 갱신, CDN 반영, 완료 보고를 진행하지 않는다. 각 ID별로 원본의 `message`, `dotmessage`, `messageTextCenter`, `l2dmessage` key 수와 번역 JSON key 수도 정확히 같아야 한다. `--write-missing-source`로 JSON이 생성된 상태는 번역 완료가 아니며, 문장부호만 있는 연출 key를 제외하고 `value == source`가 1건이라도 있으면 미완료다. 짧은 `men_`와 성인 `hmr_`도 예외 없이 포함한다.

### 번역 품질 게이트

신규 소설 번역은 아래 순서를 바꾸지 않는다. 대량 번역 성공이나 일본어 잔존 0건만으로 완료 처리하지 않는다.

1. `men_`, `hmn_`, `hmr_`, `evs_`, `mas_`의 신규 원문과 화자 메타데이터를 모두 추출한다.
2. Codex가 직접 또는 지정된 API 번역 모델로 1차 번역한다. 일본어 1인칭과 회화 속어는 음차하지 않고 화자 카드에 맞는 자연스러운 한국어로 옮긴다.
3. 신규 파일의 모든 엔트리를 별도 패스로 다시 검토한다. 직접 작업은 `translation/direct-review.md`에 따라 전체 원문·화자·앞뒤 문맥을 대조하고 기록한다. API 경로는 지정 검수 모델을 쓴다. 짧은 `men_`도 표본 검수가 아니라 전수 검수하며, API 크레딧은 직접 검수의 필수 조건이 아니다.
4. 검수 제안 중 오역, 부자연스러운 직역, 호칭·용어 위반, 잘못된 사건 관계는 모두 반영하거나 원문 근거로 기각한다.
5. 커밋 전에 신규 파일별로 `review-novel-layout.mjs --file <path> --fail`을 실행해 표시 줄당 34자 목표, 36자 상한, 최대 두 줄을 확인한다.
6. 전체 번역 검증을 통과한 뒤에만 매니페스트 갱신, 게임 캐시 복사, CDN push를 진행한다.

번역 프롬프트·스타일 문서·QA 문서의 줄 길이 규칙이 충돌하면 `scripts/prompts/novels.md`와 `translation/style-core.md`의 34/36 규칙을 최종 기준으로 삼는다. 약 50자가 들어간다는 과거 규칙은 폐기된 규칙이다.

필수 확인:

1. 신규 캐릭터명이 들어간 `translations/novels/**/ko_KR.json` 파일을 검색한다.
2. 해당 소설 value 안에 히라가나/가타카나/일본어 한자 조각이 남아 있는지 확인한다.
3. `translations/manifest/ko_KR.json`의 `novels`에 신규 소설 ID가 포함됐는지 확인한다.
4. 게임 로컬 캐시를 갱신할 때 `cache/ko_KR/novels/<id>.json`도 같이 반영됐는지 확인한다.
5. 스샷에서 대사가 일본어로 나오면 먼저 CDN 누락보다 로컬 `novels` 캐시 누락을 의심한다.
6. `scripts\audit-cached-event-novels.mjs --all-cached --deep-small-textassets`로 전체 캐시를 검사하고, `scripts\audit-novel-dialogue-metadata.mjs --all-cached --deep-small-textassets --write-index --write-missing-source`로 `message`, `dotmessage`, `messageTextCenter`, `l2dmessage` 원문과 화자 메타데이터를 추출하면서 누락된 `mas_` 원문 파일과 키를 먼저 생성한다. 이어 `scripts\audit-novel-location-titles.mjs`로 `evs_*`의 장소명·날짜/시간 전환 `messageTextCenter`가 모두 번역됐는지 원본 인덱스와 exact-key 대조한다. 런타임 로그에 수집된 말풍선은 전체 대사의 표본일 뿐이므로, 원본 `dotmessage` 전체 key 수와 번역 JSON key 수를 별도로 대조한다. 메인 스토리 ID와 `mcv_` 음성 메타데이터가 감사 결과에 포함되는지 확인한 뒤, 번역 후에는 `--write-missing-source` 없이 재검사한다.
7. 화자 기준 호칭/용어 검수를 통과시킨다. 이벤트 본편 `evs_...`나 메인 본편 `mas_...`에 캐릭터가 등장해도 파일 ID가 캐릭터 ID로 시작하지 않을 수 있으므로, `message,<speaker>,...`, `dotmessage,<speaker>,...`, `l2dmessage,<speaker>,...`의 speaker를 기준으로 character card를 적용한다. 동시에 `charaload`/`objectload`의 이름 필드를 추출해 신규 잡몹과 NPC의 `names/ko_KR.json` 누락을 검사하고, ASCII/전각 표기 변형을 별도 exact key로 확인한다.
8. 새 장을 실제로 진행한 뒤 `BepInEx/config/AbyssMod/outgame-ja_JP.json`의 수집 결과에서 한국어+일본어 혼합 key를 검색한다. 진행도 팝업처럼 제목만 동적으로 바뀌는 문구는 개별 exact key를 반복 추가하지 말고 `{[quest]}` 동적 템플릿으로 등록한다. 예: `大穴の探索が進み<br>「{[quest]}」<br>が周回可能になりました。`.
9. `Popup_QuestSelect/.../InfoNovel/TextBalloon`에 표시되는 장면 말풍선은 일반 노벨 감사에서 빠질 수 있으므로, 실제 진행 후 `NovelId`별 소설 JSON과 outgame exact 사전을 모두 확인한다.

로컬 캐시 수동 반영이 필요한 경우 repo 구조와 게임 캐시 구조가 다르다.

```text
repo: translations/novels/<id>/ko_KR.json
game: BepInEx/plugins/AbyssMod/cache/ko_KR/novels/<id>.json
```

## 검증과 반영

```powershell
# API 경로를 선택한 경우의 전수 문맥 검수 예시 (직접 경로는 translation/direct-review.md)
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\review-dialogue-openai.mjs --dir .cache\review-new-novels --model gpt-5.4-mini --force --output .cache\dialogue-review\new-novels.jsonl
# 아래 줄 길이 검사는 신규 소설 파일마다 반복하고 blocking=0을 확인
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\review-novel-layout.mjs --file translations\novels\<NOVEL_ID>\ko_KR.json --fail
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\validate-translations.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-character-abilities.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-character-ability-upgrade-matrix.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-limit-break-ability-combos.mjs --all
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-novel-location-titles.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-runtime-balloons.mjs --fail-on-mixed
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\update-manifest.mjs
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
- `<ruby=읽기>본문</>` 태그의 속성 및 본문도 검사한다. 한국어에서 독음 표시가 불필요하면 태그를 제거하고, 연출상 필요하면 읽기와 본문을 모두 한국어로 번역한다. `<ruby=きょうえい>鏡影</>`처럼 태그 안에만 일본어가 남은 값도 실패로 처리한다.
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
- 실제 캐릭터→전체 대상 스킨 참조와 획득 대사 원문을 확인하고, `outgame`/실제 `static.serif` 저장값·화자별 의미·스킨 필드 감사·설치 최종 선택값을 대조함. 획득 화면·로그 로드·CDN 게시 상태를 구분하고 빈 원문·원문 문제·미확인 화면은 따로 기록함
- 실제 캐릭터·프로필 참조와 이명·소개·좋아함·싫어함·대표 대사 전체 원문을 확인하고, 프로필 검사·게임 최종 선택값 대조 및 관련 상세 화면 검증을 완료함. 빈 원문·원문 문제·미확정·미검증 화면은 따로 기록함
- 스태프 등록 팝업과 활동 가능 연출이 한국어로 표시됨
- 신규 어빌리티 해금 팝업의 캐릭터명과 어빌리티명이 모두 한국어로 표시됨
- 한계돌파 화면의 강화 전/후 스킬/어빌리티 설명이 모두 한국어로 표시됨
- 스킬 / 어빌리티 상세 정보 화면의 스킬명, 어빌리티명, 각성 효과, 강화 어빌리티 설명이 모두 한국어로 표시됨
- 신규 캐릭터 일상/만남/개인 스토리 대사가 모두 한국어로 표시됨
- 신규·변경 교류의 모든 회차에 대해 제목·요약 원문 목록, `titles`/`descriptions`/`outgame`/해당 `static` 저장값과 적용 범위를 대조하고 목록·상세·재생/건너뛰기 팝업을 확인함. 본문 완료와 제목·요약 완료를 구분하며 미확인·미게시·보류 범위를 기록함
- CDN 번역과 게임 로컬 캐시의 신규 `novels` 파일이 누락 없이 일치함
- 신규 캐릭터 때문에 DLL을 별도로 수정하지 않아도 됨
