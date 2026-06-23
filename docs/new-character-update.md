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
- 스태프 등록 팝업
- 스태프 활동 가능 연출
- 신규 어빌리티 해금 팝업
- 한계 돌파 내용 화면
- 강화 효과 확인 팝업
- 등급 상승 후 변경되는 스킬 설명
- 등급 상승 후 변경되는 어빌리티 설명

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

## 한계돌파 강화 문구 확인

신규 캐릭터는 등급 상승에 따라 스킬과 어빌리티 성능 설명이 바뀔 수 있다. 캐릭터별로 변경 전/변경 후 설명을 모두 확인한다.

확인 대상:

- `스킬 레벨 업` 영역의 강화 후 스킬 설명
- `어빌리티 강화` 영역의 강화 후 어빌리티 설명
- `【覚醒効果】`가 붙은 전체 설명
- `<color=#...>` 태그가 포함된 수치 강조 설명
- `紋章`, `状態異常`, `クエスト中1回まで`, `バトル開始時`가 포함된 복합 설명

등록 원칙:

1. `outgame-ja_JP.json`에 수집된 실제 원문을 그대로 key로 사용한다.
2. 단독 문장만 등록하지 말고, `【覚醒効果】`까지 붙은 전체 문장이 있으면 전체 문장도 등록한다.
3. 같은 구조에서 수치만 바뀌는 문장은 `{value}`, `{rate}`, `{duration}`, `{count}` 등 동적 템플릿으로 추가한다.
4. `<br>`와 `<color>` 태그 위치는 원문과 동일하게 유지한다.
5. 한 캐릭터에서 발견된 패턴은 다른 캐릭터의 등급 상승 설명에도 재사용되는지 검색한다.

예시:

```json
"自身が付与する状態異常の確率が【15%】上昇<br><color=#D7DEF8>【覚醒効果】</color>自身の受けるダメージが【<color=#4CF37B>9.5%</color>】減少": "자신이 부여하는 상태 이상 확률이【15%】상승<br><color=#D7DEF8>【각성 효과】</color>자신이 받는 피해가【<color=#4CF37B>9.5%</color>】감소"
```

## 검증과 반영

```powershell
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\update-manifest.mjs
& "C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\validate-translations.mjs
git add translations/names/ko_KR.json translations/outgame/ko_KR.json translations/manifest/ko_KR.json docs/new-character-update.md
git commit -m "Update new character translation guide"
git push origin test
```

검증 항목:

- JSON 파싱 성공
- 캐릭터명과 어빌리티명 value가 한국어인지 확인
- `<br>`와 색상 태그 보존
- 한계돌파 강화 설명의 `【覚醒効果】`, 수치, 색상 태그 보존
- `translations/manifest/ko_KR.json` 갱신 확인

## 문제 발생 시 확인 순서

1. 캐릭터명 일본어: 이름 key가 names/outgame 양쪽에 있는지 확인한다.
2. 어빌리티명 일본어: 어빌리티명 독립 key가 outgame에 있는지 확인한다.
3. 한계돌파 강화 설명 일본어: `outgame-ja_JP.json`에 수집된 전체 문장이 outgame 번역에 있는지 확인한다.
4. 재시작 후에도 일본어: 실제 문장이 기존 템플릿과 같은지 비교한다.
5. 태그 또는 색상 오류: 원문의 `<color>` 범위와 템플릿 토큰 위치를 확인한다.
6. CDN 미반영: manifest hash와 `test` 브랜치 push 여부를 확인한다.

## 완료 기준

- 신규 캐릭터 이름이 모든 UI에서 한국어로 표시됨
- 스태프 등록 팝업과 활동 가능 연출이 한국어로 표시됨
- 신규 어빌리티 해금 팝업의 캐릭터명과 어빌리티명이 모두 한국어로 표시됨
- 한계돌파 화면의 강화 후 스킬/어빌리티 설명이 모두 한국어로 표시됨
- 신규 캐릭터 때문에 DLL을 별도로 수정하지 않아도 됨
