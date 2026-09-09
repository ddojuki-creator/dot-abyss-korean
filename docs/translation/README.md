# Translation Guide Index

This folder is the canonical instruction set for AI-assisted Korean translation work in the new-version AbyssMod repository.

When a rule appears in a handoff, chat log, or one-off work note and should be applied repeatedly, move it into the appropriate file in this folder.

## Start Rules

Before editing translation files:

1. Read this file, `style-core.md`, `glossary.md`, `forbidden.md`, `tags-placeholders.md`, and `qa-checklist.md`.
2. For dialogue, story, or character voice work, also read `character-cards.md`, `character-voice.md`, `context-review.md`, and `adult-content.md`.
3. For UI, skill, ability, system text, popup text, or runtime-composed text, also read `ui-system.md`, `tags-placeholders.md`, and `../outgame-update-qa.md`.
4. For character, skill, ability, awakening, limit-break, or pure crystal updates, read `../new-character-update.md` first.
5. Search the whole `translations` tree for the same character name, skill name, ability name, event name, and forbidden variant before editing only one file.
6. Never change JSON keys. Edit Korean values only.
7. Put reusable language rules in the correct canonical layer: general meaning/grammar/layout in `style-core.md`, shared terms/slang/idioms in `glossary.md`, forbidden output variants in `forbidden.md`, and only speaker-specific tone/address/relationship rules in `character-cards.md`. Do not place a general rule in a character card just because one character exposed it first.
8. After edits, run the relevant validation/audit scripts and regenerate `translations/manifest/ko_KR.json` with `scripts/update-manifest.mjs`.
9. For final review of a batch whose translation and first review are complete, read `final-review.md` and preserve the completed stages. Freeze the current source, translation, and instruction versions before reviewing.
10. Read `supplementary-reference.md` for optional fourth-priority lexical help. Query only unresolved expressions; neither the project supplemental lexicon nor external dictionary overrides source context or approved project rules.
11. For ongoing full final review, resume from `../reviews/final-review/README.md` and `NEXT.md`. Run `node scripts/final-review-progress.mjs status`; skip unchanged completed files and persist each actually reviewed range before moving on.
12. The 2026-09-06 user decision makes instruction supplements prospective: do not re-review completed translations merely because guides changed. Preserve original receipts and follow the completion-preservation policy in `final-review.md`; this is not a new semantic approval or a release approval.
13. For novels, the ruby-specific policy in `tags-placeholders.md` and `../../scripts/prompts/novels.md` overrides generic tag-preservation wording. Do not restore unnecessary Japanese readings into Korean values.

## New-Version Translation Layers

| Folder | Role |
| --- | --- |
| `translations/static` | MasterData/static bundle. Main layer for source-data text such as skills, abilities, equipment, character data, quests, and static records. |
| `translations/outgame` | UI, buttons, popups, runtime-composed exact keys, mixed Korean/Japanese fallback keys, and compatibility translations. |
| `translations/novels` | Novel/story body text. |
| `translations/names` | Character, summon, and display names. |
| `translations/titles` | Story, episode, event, and title strings. |
| `translations/descriptions` | Profiles, story summaries, package descriptions, item descriptions, and related prose. |
| `translations/another_name` | Alternate names and aliases. |
| `translations/ability_descriptions` | Legacy/compatibility ability-description source used by static bundle generation. |
| `translations/manifest` | Generated hashes. Do not translate or manually edit. |

The new version uses a hybrid structure:

```text
MasterData/static = primary translation layer
outgame          = UI and runtime-composed fallback layer
novels           = novel body layer
```

Do not assume `static` makes `outgame` unnecessary. Many UI screens assemble Japanese wrappers around already translated names/effects, so mixed exact keys and dynamic outgame rules remain necessary.

## Canonical Files

1. `style-core.md`: Korean prose style and line-layout rules.
2. `glossary.md`: official terms, names, addresses, and forbidden variants.
3. `forbidden.md`: high-level "never do this" rules.
4. `character-cards.md`: per-character voice, personality, and address rules.
5. `tags-placeholders.md`: placeholders, tags, line-break controls, and rich-text preservation.
6. `qa-checklist.md`: final QA and audit expectations.
7. `ui-system.md`: UI/system text principles.
8. `direct-review.md`: API 없는 직접 번역·전수 문맥 검수와 검수 기록. API 전용이라는 과거 절차보다 우선한다.
9. `final-review.md`: 완료된 번역·초벌 검수 이후의 정밀 검수 범위, 중복 등장 문맥, 버전 기록 및 판정 기준.
10. `supplementary-reference.md`: 4순위 보조 참고 정책. `supplementary-lexicon.json`은 문맥별 후보·주의 사례, `supplementary-source.json`은 로컬 외부 자료의 고정 출처·해시다.

Dialogue work also needs `character-voice.md`, `context-review.md`, and `adult-content.md`.

## Domain Entry Points

| Work domain | Read first |
| --- | --- |
| New or changed character, skill, ability, awakening, limit-break, pure crystal | `../new-character-update.md` |
| Outgame UI, popup, runtime collection, mixed Korean/Japanese UI | `../outgame-update-qa.md` |
| New or changed story, novel body, story title, replay popup, unlock condition | `../story-novel-check.md` |
| MasterData/static bundle refresh | Root handoff plus `qa-checklist.md` |
| Novel/story text | This folder plus novel audit scripts |
| Final review after translation and first review | `final-review.md`, previous review records, and current source metadata |

## Minimum Completion Criteria

- JSON parses successfully.
- No untranslated Japanese remains in changed values unless intentionally preserved as a source term.
- `glossary.md` and `forbidden.md` are not violated.
- Character voice and address rules match `character-cards.md` when the speaker is known.
- Non-layout tags, placeholders, TMP/Unity rich text attributes, and runtime tokens are preserved. Line breaks follow `tags-placeholders.md`, not the source break count for novels.
- `translations/manifest/ko_KR.json` is regenerated by script, not edited by hand.
- For static changes, `translations/static/ko_KR.missing.json` should be `{}` and `audit-static-bundle` should pass.

## Useful Commands

Use the repository's normal Node runtime. If `node` is not on PATH in Codex, use the bundled runtime path from the current handoff.

```powershell
node scripts\validate-translations.mjs
node --test scripts\tests\translation-guidance.test.mjs
node scripts\audit-outgame-critical.mjs
node scripts\audit-outgame-ui-hotspots.mjs
node scripts\audit-static-bundle.mjs
node scripts\audit-masterdata-coverage.mjs
node scripts\audit-character-abilities.mjs
node scripts\audit-character-ability-upgrade-matrix.mjs
node scripts\audit-limit-break-ability-combos.mjs --all
node scripts\update-manifest.mjs
```

## Handoff Rule

Before starting a new chat, read the latest new-version handoff in the repository root and the original master handoff referenced there. The latest handoff records DLL hashes, CDN commit state, local cache paths, and screen-specific fixes that may not be obvious from translation files alone.
