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

## 실패했을 때

감사 출력의 `source`를 그대로 `translations/outgame/ko_KR.json` key로 추가한다. 줄바꿈이 화면에서만 바뀐 것처럼 보여도 실제 원문이 `\n`인지 `<br>`인지 확실하지 않으면 두 변형을 함께 등록한다.
