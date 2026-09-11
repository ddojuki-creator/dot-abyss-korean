# UI And System Text

- Translate UI, buttons, menus, item names, status names, and system messages briefly and clearly.
- Prefer concise Korean game UI terms.
- Button labels should be short when possible.
- Do not give system messages a character voice.
- Do not over-explain short labels.

## Mission Quantities And Source Evidence

- Identify the counted object, target level, repetition count, and AND/OR relation separately. `アビリティレベルを10個10Lvにする` means `어빌리티 10개를 레벨 10으로 만들기`, not `어빌리티 레벨 10개`. Preserve each numeric variant and distinguish ordinary level from bond level.
- `キャラクターにプレゼントを5回渡す` counts giving actions to a character, not five characters or five distinct items. `限界突破かマナ覚醒` permits either action; do not require both. Keep UI digits even when prose uses Korean counters.
- A string-only master snapshot proves the exact source text/table/field, not absent numeric references or live runtime behavior. `charaload` display names and message speakers are separate fields; missing an exact name key is a follow-up finding, not proof that all fallback lookup fails.
- When the source itself contains a placeholder such as `キャッチフレーズ100003`, a faithful literal translation may be recorded only as literal correspondence with an explicit source-data issue. Do not invent a real catchphrase or claim the source content is complete. Unknown abbreviations, sorting labels such as `き`, or unclear UI roles remain unresolved until context is verified.

## Combat Meaning

- Before rewriting an effect, identify the trigger, qualifying participants, target, calculation basis, amount, duration, success chance, and stacking limit separately. Preserve each relation; a fluent Korean sentence is not proof that its combat meaning is correct.
- Preserve the set governed by `以外`, `のみ` and similar restrictions. `光、闇、無属性以外に耐性` means resistance to attributes other than 광, 암, 무속성; the listed three are excluded from that resistance. Keep `내성`/reduced damage distinct from complete immunity, and read the whole list across line breaks before placing the Korean restriction.
- Distinguish `200%로 상승` (resulting multiplier) from `200% 상승` (increase amount). Do not silently reinterpret a resulting multiplier as an additive bonus.
- Distinguish `아군 1명의 HP를 최대 HP의 ...만큼 회복` from a buff to maximum HP. If the source does not identify whose maximum HP is the basis, do not invent an owner; consult the actual effect data or record the ambiguity.
- For absorption, retain the self-recipient and inflicted-damage basis: `자신의 HP를 입힌 피해의 ...만큼 회복`. Do not change inflicted damage into received damage or healing another ally.
- A condition may restrict which chain participants contribute to a sum or bonus. Do not replace the qualifying participants with all allies. A number of removable status effects is not a number of affected characters.
- Do not repair surprising mechanics based on the attribute theme. A passion-emblem condition that applies freezing must remain freezing when that is the verified source. Check the source/data rather than changing it to ignition.
- In a change to the next normal attack or heal, keep every listed effect attached to that next action. A normal attack that becomes skill charging becomes a charging action; do not imply it still deals damage as well. Prefer `피해를 주는 공격으로 변화` over wording that makes the attack itself become damage.
- Keep parallel effects separate from conditions: flying movement plus increased critical chance does not mean the critical bonus applies only while flying. When a summoned plant or cannon inherits `自身のパラメーター`, identify the owning character as the stat source when that relationship is established; do not make the summon inherit its own stats.
- After changing a status or buff term, recheck Korean particles outside specification brackets. `빙결【…】을`, `발화【…】를`, `스킬 충전 효율 증가【…】를`, and `공격력 UP【…】을` follow the noun before the bracket; UP is read as 업. Check plain and colored variants separately.

## Dynamic Text And Copies

- Distinguish an exact source-field string, a generated display variant, and an actually collected runtime string. For composed text, connect the source fields, each replacement value's source and hash, color rules, and exact reconstructed result. A collected `125%`/`400%` replacement for a `TRACK` placeholder is not a literal number stored in that source field or proof of the actual combat effect. Report shared-meaning review, numeric/tag validation, individually read variants, and observed runtime coverage separately; generated variants are not automatically independently reviewed or observed in-game.
- Review a translated name together with its replay, unlock, acquisition, level-cap, and clear-condition wrappers. A translated title surrounded by Japanese is still incomplete. Preserve historical exact keys and add only verified runtime variants or supported templates; do not invent placeholder syntax.
- After changing a shared term/effect, inspect corresponding `titles`, `descriptions`, `outgame`, `ability_descriptions`, and structured `static` paths as applicable. Equal source text at multiple table paths is not a single stored item; follow the actual table/field relationship.
- Do not make every copy byte-identical when rendering requires different color markup. Verify equivalent meaning, numbers, and balanced required tags; plain, green-number, yellow-number, and status-color variants can be separate keys.
- A numeric or color diagnostic requires an item-specific decision. `1人` to prose `혼자` may preserve quantity, and verified static-only status colors may be intentional. Never suppress all warnings or strip required tags just to obtain zero warnings.
- `30秒に1回` may be translated as `30초마다`: the once-per-period meaning is retained even though a numeric-token check sees one fewer `1`. Verify the exact period and every other amount, target count, duration and quest limit for that row; do not waive unrelated numeric differences. For shared numeric structures, retain the full wording and tags plus each row's numeric values, and reread the actual saved wording before recording completion.
- A dummy, malformed placeholder, or unknown abbreviation is not approved merely because it parses or has no Japanese. Record it as unresolved until its runtime role or source meaning is established.
- A stored static dictionary path does not prove that its table/field is loaded by the current `Config/master.json` or matched by the current source. Verify the field mapping and exact source evidence separately. An inactive field with insufficient authority stays on hold; do not enable a field merely to justify approving its translation.
- For numeric-only or diagnostic-looking strings, record the exact value and the checked source/runtime scope. Zero matches in a snapshot or collected log means no match was observed there, not that the string can never appear. Preserve unexplained strings without inventing display text, and do not claim a screen check from a source-only lookup.
