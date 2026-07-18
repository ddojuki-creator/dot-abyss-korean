# Novel Translation Prompt

Translate scenario dialogue and narration.
Prioritize character voice, emotional nuance, and natural Korean game dialogue.
For the fixed two-line story dialogue window, use at most one `<br>`. Target at most 34 visible Korean characters per rendered line and never exceed 36; if the meaning does not fit in two lines, compress the wording instead of creating a third line.
This 34-character target and 36-character hard limit override any older note, source line length, or assumption that roughly 50 Korean characters fit. Recompose the complete Korean sentence before placing the single line break; never preserve a Japanese break mechanically when it makes the Korean clauses attach incorrectly.
Translate Japanese first-person pronouns by meaning and speaker voice. `アタシ`/`あたし`/`私`/`オレ`/`俺` normally become `나` or `저`; never leave phonetic forms such as `아타시` or `오레` in Korean dialogue.
Translate slang by function rather than katakana sound. For example, `チル` means relaxing/chilling and must not become `칠` or `칠하다`, while `ギャップ萌え` should become natural Korean such as `반전 매력`, not the raw loan form `갭모에` when it sounds unnatural.
After bulk translation, every new `men_`, `hmn_`, and `hmr_` value requires a separate adjacent-context review. A short `men_` file is still character dialogue and must never be treated as a common UI-label batch.
Never leave Japanese script inside a Korean value, including the reading or base text of `<ruby=reading>base</>` markup. Remove ruby markup when Korean needs no alternate reading; when it is semantically important, translate both the ruby reading and base text into Korean.
Treat every `messageTextCenter` location/time transition as required dialogue coverage. Translate `<size=48>――place</size>`, `翌日`, and `数日後` exact keys across the complete `evs_*` event set.
In adult narration, translate 肉棒 as 육봉 or 남근 according to context. Do not use 음경, 정액, 고환, 고기, or 고기봉 for 肉棒; preserve the fixed skill/title 육봉연술.
For the 2026-07-10 characters, follow the speaker metadata and the detailed cards for リエラ, アイシャ, and ルシータ. Never turn リエラ into Berisa-style mesugaki dialogue or add `허접` taunts unless the Japanese source explicitly contains them.
For the 2026-07-17 characters, follow the detailed cards for フィオナ and クリスティ. Fix フィオナ=피오나, クリスティ=크리스티, あるじさま=주인님 for Fiona, and 司令官さん=사령관씨 for Christie. Keep every spirit-name spelling and deliberate misnaming distinct using the glossary spellings; do not silently correct the dialogue joke to ポパパポパ.
## Main-story cache coverage

- Main-story scenario IDs use the `mas_` prefix and commonly have a 10-digit numeric suffix, unlike the 11-digit suffix used by many `evs_`, `hmn_`, `hmr_`, and `men_` IDs. Treat `mas_` as a first-class novel source.
- Main-story voice metadata can use `mcv_` as well as `vc_`; metadata is not dialogue and must never be included in a translation key.
- Main-story world speech balloons use `dotmessage,<speaker>,<text>,...` and must be extracted in full from the cached TextAsset. Never treat the few `Runtime balloon audit` lines collected during manual play as the complete story dialogue. Strip the trailing `,,` voice/emotion/position metadata, compare the full `dotmessage` source-key count with the novel translation file, and apply character cards from the `speaker` field.
- For every new story, collect all `message`/`dotmessage`/`l2dmessage` speakers plus `charaload`/`objectload` display names and check them against `translations/names/ko_KR.json`; ASCII/full-width variants such as `信者A` and `信者Ａ` are separate keys.
- When a new chapter is opened, verify the complete logged `mas_` ID set and run the full-cache audit after the time-filtered extraction.
