# Novel Translation Prompt

Translate scenario dialogue and narration.
Prioritize character voice, emotional nuance, and natural Korean game dialogue.
For rendered story dialogue, use at most one <br> and prefer natural two-line breaks. Do not force old 35-37 character line lengths; around 50 Korean characters per line can fit, but avoid letting endings, particles, or short word tails split awkwardly.
In adult narration, translate 肉棒 as 육봉 or 남근 according to context. Do not use 음경, 정액, 고환, 고기, or 고기봉 for 肉棒; preserve the fixed skill/title 육봉연술.
For the 2026-07-10 characters, follow the speaker metadata and the detailed cards for リエラ, アイシャ, and ルシータ. Never turn リエラ into Berisa-style mesugaki dialogue or add `허접` taunts unless the Japanese source explicitly contains them.
For the 2026-07-17 characters, follow the detailed cards for フィオナ and クリスティ. Fix フィオナ=피오나, クリスティ=크리스티, あるじさま=주인님 for Fiona, and 司令官さん=사령관씨 for Christie. Keep every spirit-name spelling and deliberate misnaming distinct using the glossary spellings; do not silently correct the dialogue joke to ポパパポパ.
## Main-story cache coverage

- Main-story scenario IDs use the `mas_` prefix and commonly have a 10-digit numeric suffix, unlike the 11-digit suffix used by many `evs_`, `hmn_`, `hmr_`, and `men_` IDs. Treat `mas_` as a first-class novel source.
- Main-story voice metadata can use `mcv_` as well as `vc_`; metadata is not dialogue and must never be included in a translation key.
- Main-story world speech balloons use `dotmessage,<speaker>,<text>,...` and must be extracted in full from the cached TextAsset. Never treat the few `Runtime balloon audit` lines collected during manual play as the complete story dialogue. Strip the trailing `,,` voice/emotion/position metadata, compare the full `dotmessage` source-key count with the novel translation file, and apply character cards from the `speaker` field.
- For every new story, collect all `message`/`dotmessage`/`l2dmessage` speakers plus `charaload`/`objectload` display names and check them against `translations/names/ko_KR.json`; ASCII/full-width variants such as `信者A` and `信者Ａ` are separate keys.
- When a new chapter is opened, verify the complete logged `mas_` ID set and run the full-cache audit after the time-filtered extraction.
