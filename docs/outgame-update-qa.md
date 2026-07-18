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
- `m_disaster_boss_messages`: 재앙/보스 메시지
- `m_idle_exploration_log_messages`: 탐색 로그 메시지
- `m_interaction_voices`: 상호작용 대사
- `m_part_voices`: 파트/캐릭터 짧은 대사
- `m_tavern_dialogue`: 술집/시설 대화
- `m_transition_tips`: 로딩/전환 팁

## 동적 구독 알림

- 구독 상품명은 먼저 번역된 뒤 일본어 안내문과 결합될 수 있으므로 `outgame-ja_JP.json`에서 한국어와 일본어가 섞인 key도 확인한다.
- `「상품명」の継続購入が行えなかったため解約しました。` 형식은 개별 상품명만 등록하지 말고 `「{[product]}」の継続購入が行えなかったため解約しました。` 동적 템플릿도 함께 등록한다.
- 팝업 제목 `通知`와 캐릭터/탐색대 획득 지원 등 실제 수집된 완성 문구를 함께 확인한다.
- `scripts/audit-outgame-ui-hotspots.mjs`에서 미번역과 일본어 잔존이 0건인지 확인한다. 새 상품명이 템플릿으로 처리되면 `dynamicCovered`에 집계된다.

## 실패했을 때

감사 출력의 `source`를 그대로 `translations/outgame/ko_KR.json` key로 추가한다. 줄바꿈이 화면에서만 바뀐 것처럼 보여도 실제 원문이 `\n`인지 `<br>`인지 확실하지 않으면 두 변형을 함께 등록한다.
