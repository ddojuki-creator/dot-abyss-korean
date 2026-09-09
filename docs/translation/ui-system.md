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
- Distinguish `200%로 상승` (resulting multiplier) from `200% 상승` (increase amount). Do not silently reinterpret a resulting multiplier as an additive bonus.
- Distinguish `아군 1명의 HP를 최대 HP의 ...만큼 회복` from a buff to maximum HP. If the source does not identify whose maximum HP is the basis, do not invent an owner; consult the actual effect data or record the ambiguity.
- For absorption, retain the self-recipient and inflicted-damage basis: `자신의 HP를 입힌 피해의 ...만큼 회복`. Do not change inflicted damage into received damage or healing another ally.
- A condition may restrict which chain participants contribute to a sum or bonus. Do not replace the qualifying participants with all allies. A number of removable status effects is not a number of affected characters.
- Do not repair surprising mechanics based on the attribute theme. A passion-emblem condition that applies freezing must remain freezing when that is the verified source. Check the source/data rather than changing it to ignition.

## Dynamic Text And Copies

- Distinguish an exact source-field string, a generated display variant, and an actually collected runtime string. For composed text, connect the source fields, each replacement value's source and hash, color rules, and exact reconstructed result. A collected `125%`/`400%` replacement for a `TRACK` placeholder is not a literal number stored in that source field or proof of the actual combat effect. Report shared-meaning review, numeric/tag validation, individually read variants, and observed runtime coverage separately; generated variants are not automatically independently reviewed or observed in-game.
- Review a translated name together with its replay, unlock, acquisition, level-cap, and clear-condition wrappers. A translated title surrounded by Japanese is still incomplete. Preserve historical exact keys and add only verified runtime variants or supported templates; do not invent placeholder syntax.
- After changing a shared term/effect, inspect corresponding `titles`, `descriptions`, `outgame`, `ability_descriptions`, and structured `static` paths as applicable. Equal source text at multiple table paths is not a single stored item; follow the actual table/field relationship.
- Do not make every copy byte-identical when rendering requires different color markup. Verify equivalent meaning, numbers, and balanced required tags; plain, green-number, yellow-number, and status-color variants can be separate keys.
- A numeric or color diagnostic requires an item-specific decision. `1人` to prose `혼자` may preserve quantity, and verified static-only status colors may be intentional. Never suppress all warnings or strip required tags just to obtain zero warnings.
- A dummy, malformed placeholder, or unknown abbreviation is not approved merely because it parses or has no Japanese. Record it as unresolved until its runtime role or source meaning is established.
