# Outgame Update QA

게임 업데이트 후 outgame 텍스트를 갱신할 때는 일반 UI 라벨뿐 아니라 연출용 말풍선/짧은 대사 테이블도 반드시 확인한다.

## 필수 흐름

1. 최신 게임 캐시를 추출한다.
2. outgame 번역을 적용한다.
3. 주요 연출 테이블 감사를 실행한다.
4. 검증과 manifest 갱신 후 CDN `test` 브랜치에 반영한다.

권장 명령:

```powershell
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\outgame-update.mjs
```

수동 감사:

```powershell
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-outgame-critical.mjs
```

## 특히 놓치기 쉬운 테이블

- `m_plan_step_serifs`: 시설/플랜/업데이트 단계 말풍선 대사
- `m_battle_result_reactions`: 전투 결과 반응 대사
- 이 표의 원문 존재 검사만으로 게임 적용을 완료 처리하지 않는다. [전투 결과 대사 필수 확인](new-character-update.md#전투-결과-대사-필수-확인)의 캐릭터 참조·결과 구분별 행·실제 조회 순서 대조와 설치 캐시 재검사를 수행한다.
- `m_disaster_boss_messages`: 재앙/보스 메시지
- `m_event_top_characters`: 이벤트 메인 화면 캐릭터 말풍선/조건별 대사
- `m_character_skins.serif`: 캐릭터/의상 획득 대사. 감사는 실제 snapshot 필드 `6`만 선택하며 이름/설명 `4`/`5`와 구별한다. 전체 스킨 참조·원시 row·화자·설치 적용은 [가챠 획득 대사 필수 확인](new-character-update.md#가챠-획득-대사-필수-확인)을 따른다.
- `m_idle_exploration_log_messages`: 탐색 로그 메시지
- `m_interaction_voices`: 상호작용 대사
- `m_part_voices`: 파트/캐릭터 짧은 대사
- `m_tavern_dialogue`: 술집/시설 대화
- `m_transition_tips`: 로딩/전환 팁

## 이벤트 캐릭터 말풍선 필수 확인

이벤트 신규 추가·스토리/진행도 확장·등장 캐릭터 변경 시, `evs_*` 본문과 별도로 이벤트 메인 화면의 캐릭터 대사를 필수 확인한다. 이벤트 본문·제목·요약이 번역되어 있어도 이 말풍선의 번역/적용 완료를 대신하지 않는다.

1. 최신 원시 MasterData의 실제 이벤트 참조로 `m_event_top_characters` 대상 row를 전부 목록화한다. event ID·row ID·character/asset/skin 참조·대사 원문·표시 종류·연결된 조건/group·원본 버전/해시를 기록한다. ID의 숫자 모양으로 관계를 추정하지 않는다. 미진행·잠긴·아직 표시되지 않은 조건과 반복 대사도 포함하고 빈 대사/테스트 원문은 원시 row 근거로 따로 기록한다. 문자열 snapshot에는 숫자 참조·조건·빈 필드가 없을 수 있으므로 snapshot만으로 전체 row를 확정하지 않는다.
2. 실제 `serif` 필드 매핑을 확인한다. 현재 추출 위치는 `m_event_top_characters/id:<rowID>/6`이며 게임 매핑이 달라지면 다시 대조한다. 모든 비어 있지 않은 대사를 정확한 원문 key로 `translations/outgame/ko_KR.json`과 `static.m_event_top_characters.serif`에서 확인한다. 원문 위치 수·고유 key 수·static 복제 수를 구분한다. 누락·빈 번역·원문 그대로·일본어 잔존은 미완료다.
3. 실제 표시 asset/인물 참조로 화자를 확인해 정본 이름·호칭·말투를 적용하고 원문과 최종 저장값을 재독한다. 임시 character ID와 실제 asset이 충돌하면 다른 원시 인물/asset 근거를 대조하고 불일치를 기록한다. 한 필드만으로 화자를 단정하거나 임의 설정을 추가하지 않는다. UI 말풍선의 줄 수·단어 경계도 확인하며, 의미·태그·변수를 줄 길이 때문에 삭제하지 않는다.
4. `node scripts/audit-outgame-critical.mjs`로 해당 테이블의 저장소 원문 누락을 검사한다. 이 도구는 실제 조건/화자 참조·전체 빈 row·설치 사전·화면을 인증하지 않으며, `--added-only`는 전체 이벤트 원문 목록을 대신하지 않는다. 대상 이벤트의 원문 인벤토리와 검사 결과를 전수 대조하고 다른 표의 기존 오류·보류와 구분한다.
5. 설치 DLL의 실제 UI 조회 순서와 exact key의 **최종 선택값**을 확인한다. 현재 Outgame→Names→Titles→Descriptions→지속 로컬 사전 순서에서는 상위 사전의 원문/빈 값도 하위 번역을 가릴 수 있다. 게임 `static`은 별도로 집계한다. 저장소/static에 번역이 있다는 이유로 게임 적용을 완료 처리하지 않는다. 로컬 보완은 백업 후 검수된 키만 기존값을 보존하여 병합하고 게임 캐시·manifest 전체를 덮어쓰지 않는다.
6. 실제 수집 key와 구현으로 확인한 변형만 추가한다. LF·CRLF·문자열 `\n`·`<br>`를 구분하고 원본 key를 보존한다. 조건별 캐릭터 교체·진행 전후·반복/종료 대사를 실제 화면에서 확인한 범위, 원시 row 전수 대조, 의미 검수, 기술 검사, 설치 선택값, 로그 로드, CDN 게시 상태를 각각 기록한다. 미확인 조건/화면은 따로 남기며 한 말풍선이나 수집 표본으로 이벤트 전체 완료를 주장하지 않는다.

## 스킵 확인 팝업 필수 확인

- 플로어·시간·스테이지 스킵 UI가 추가되거나 변경되면 실제 `outgame-ja_JP.json`에서 제목, 안내, 이용 조건, 티켓 비용, 소모 배율, 보상과 한국어/일본어 혼합 key를 함께 목록화한다. 원본 key의 실제 LF·후행 CRLF·색 태그를 구분해 보존하고, `node scripts/audit-outgame-ui-hotspots.mjs`로 스킵 문구 전체를 검사한다. 수집 표본 밖 화면까지 완료로 확대하지 않는다.
- 확인 팝업과 별도로 진행 중·완료 화면의 짧은 조작 버튼도 실제 수집 key로 확인한다. `中断する`처럼 버튼 원문에 `スキップ`가 없어도 해당 흐름의 검사 범위에 포함한다. 중단·취소·일시정지·종료·보상 수령은 실제 원문과 기능 근거로 구별하며, 보지 않은 버튼 원문을 추정 생성하지 않는다. 감사의 `checked=0`은 해당 버튼 번역 통과가 아니다.
- 숫자가 달라지는 안내는 현재 설치 DLL이 지원하는 템플릿과 실제 수집값으로 검증한다. 층수·티켓 수·탐색 시간 분량·고정 소모 배율을 각각 보존하고 색 태그·자리표시자를 검사한다. 지원 템플릿을 추가하되 미관측 숫자 exact key를 추정 생성하지 않는다. `dynamicCovered`는 key 패턴 일치 집계이므로 템플릿 값의 의미·일본어 잔존·보호 요소 검수를 대신하지 않는다.
- 설치 적용은 [이벤트 말풍선 절의 exact 조회 확인](#이벤트-캐릭터-말풍선-필수-확인)과 같은 실제 Outgame→Names→Titles→Descriptions→지속 로컬 사전 순서로 최종 선택값을 확인한다. 상위 사전의 빈값/원문도 하위 번역을 가릴 수 있다. 저장소 검사, 설치 사전·템플릿 적용, 로드 로그, 실제 숫자 변형·화면 확인과 CDN 게시를 별도 기록한다. 생성 변형이나 사전 존재는 실제 화면 확인을 대신하지 않는다.

## 동적 구독 알림

- 구독 상품명은 먼저 번역된 뒤 일본어 안내문과 결합될 수 있으므로 `outgame-ja_JP.json`에서 한국어와 일본어가 섞인 key도 확인한다.
- `「상품명」の継続購入が行えなかったため解約しました。` 형식은 개별 상품명만 등록하지 말고 `「{[product]}」の継続購入が行えなかったため解約しました。` 동적 템플릿도 함께 등록한다.
- 팝업 제목 `通知`와 캐릭터/탐색대 획득 지원 등 실제 수집된 완성 문구를 함께 확인한다.
- `scripts/audit-outgame-ui-hotspots.mjs`에서 미번역과 일본어 잔존이 0건인지 확인한다. 새 상품명이 템플릿으로 처리되면 `dynamicCovered`에 집계된다.

## 누적 탐색 기록

- 탐색 기록은 여러 줄이 하나의 UI 텍스트에 계속 누적되며, 문장 틀이 먼저 번역된 뒤 탐색대 명칭만 `探索隊A/B/C`로 삽입될 수 있다.
- `探索隊C가 귀중한 골재를 발견했다!`처럼 한국어 문장 안에 일본어 탐색대 명칭만 남은 항목도 누락으로 판정한다. `探索隊A/B/C` 단독 key가 번역돼 있다는 이유로 통과시키지 않는다.
- 개별 누적 조합을 exact key로 반복 추가하지 않는다. DLL의 탐색 기록 정규화가 각 줄을 `탐색대 A/B/C가 ... 발견했다!`로 처리하는지 확인한다.
- `scripts/audit-outgame-ui-hotspots.mjs` 결과에서 이러한 동적 기록은 `runtimeCovered`로 집계된다. 새 문장 형태가 `missing`으로 나오면 정규화 규칙을 먼저 보강한다.

## 실패했을 때

감사 출력의 `source`를 그대로 `translations/outgame/ko_KR.json` key로 추가한다. 화면의 줄바꿈과 실제 원문 key를 구분하고 수집 파일·원시 자료·구현으로 확인한 변형만 등록한다. `\n`/`<br>`가 불명확하면 실제 key를 먼저 확인하고 미확인 변형을 일괄 생성하지 않는다.
