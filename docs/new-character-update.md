# 신규 캐릭터 번역 반영 작업 지시서

## 목적

게임 업데이트로 신규 캐릭터가 추가되었을 때 이름, 어빌리티, 스태프 등록 안내, 한계돌파 강화 설명을 한국어 CDN에 안전하게 반영한다.

## 핵심 원칙

1. JSON key는 일본어 원문 그대로 유지하고 value만 한국어로 작성한다.
2. 일본어 캐릭터명은 `translations/names/ko_KR.json`과 `translations/outgame/ko_KR.json` 양쪽에 등록한다.
3. 신규 어빌리티명은 `translations/outgame/ko_KR.json`에 독립 key로 등록한다.
4. `<br>`, `<color>`, TMP 태그와 특수기호를 변경하지 않는다.
5. CDN 변경은 항상 `test` 브랜치에 commit/push한다.

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

특히 신규 캐릭터의 `men_`, `hmn_`, `hmr_` 소설 파일이 추가되면 CDN에 번역이 있어도 게임 로컬 캐시에 해당 `novels/<id>.json`이 없으면 화면에서 일본어 원문으로 fallback 될 수 있다. 신규 캐릭터 반영 후에는 manifest의 novels 수와 게임 로컬 캐시의 novels 파일 수/해시를 반드시 확인한다.

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
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\audit-novel-location-titles.mjs
git add translations/names/ko_KR.json translations/outgame/ko_KR.json translations/manifest/ko_KR.json docs/new-character-update.md
git commit -m "Update new character translation guide"
git push origin test
```

검증 항목:

- JSON 파싱 성공
- 캐릭터명과 어빌리티명 value가 한국어인지 확인
- 신규 캐릭터 관련 `names`, `titles`, `descriptions`, `outgame`, `novels`, `another_name` key 누락이 없는지 확인
- `ドリンク`는 `음료`가 아니라 `드링크`로 번역했는지 확인
- `<br>`와 색상 태그 보존
- 한계돌파 강화 설명의 `【覚醒効果】`, 수치, 색상 태그 보존
- `m_ability_details`와 런타임 exact key의 한계돌파/각성 설명 일본어 잔존 0건
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
8. CDN 미반영: manifest hash와 `test` 브랜치 push 여부를 확인한다.

## 완료 기준

- 신규 캐릭터 이름이 모든 UI에서 한국어로 표시됨
- 스태프 등록 팝업과 활동 가능 연출이 한국어로 표시됨
- 신규 어빌리티 해금 팝업의 캐릭터명과 어빌리티명이 모두 한국어로 표시됨
- 한계돌파 화면의 강화 전/후 스킬/어빌리티 설명이 모두 한국어로 표시됨
- 스킬 / 어빌리티 상세 정보 화면의 스킬명, 어빌리티명, 각성 효과, 강화 어빌리티 설명이 모두 한국어로 표시됨
- 신규 캐릭터 일상/만남/개인 스토리 대사가 모두 한국어로 표시됨
- CDN 번역과 게임 로컬 캐시의 신규 `novels` 파일이 누락 없이 일치함
- 신규 캐릭터 때문에 DLL을 별도로 수정하지 않아도 됨
