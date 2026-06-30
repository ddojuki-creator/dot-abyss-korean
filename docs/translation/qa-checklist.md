# QA Checklist

- JSON parses successfully.
- Every translation file is a JSON object.
- `translations/manifest/ko_KR.json` is generated, not translated.
- Keys match upstream `zh_Hans.json`.
- Values are non-empty strings.
- Placeholders and non-layout tags are preserved; line-break controls follow the Korean line-layout policy.
- During final layout review, text normally uses one line, never exceeds two displayed lines, and aims for 35 characters or fewer per line.
- Novel dialogue ignores the Japanese line-break position during final layout. Reflow Korean from the first word, fill the first line up to the 35-character target without splitting words, and keep every displayed line at or below the 37-character hard limit.
- Novel location/title cards must preserve visible Korean word spacing. Do not collapse forms such as `어비스빛의계층`; use `어비스 빛의 계층`.
- Non-novel line breaks are used only when context or readability requires them and are never added beyond the source count unless a local rule explicitly allows it.
- Character voice and speech level are consistent.
- UI text is concise.
- No invented setting, relationship, or emotion was added.

## CDN Update QA

- After a client update, confirm whether the local game `DownloadCache` date/hash actually changed before assuming new CDN/server text was extracted.
- Check added, changed, and removed source text. Do not treat "no new file" as "no work"; balance updates can modify existing skill, ability, shop, notice, and proposal-card text.
- Inspect `.cache/game-cache-extract-report.json` `changes.added`, `changes.changed`, and `changes.removed` after `extract-game-cache`.
- Run upstream sync dry-run and review `addedKeys` / `removedKeys`; changed source strings usually appear as old removed keys plus new added keys.
- For balance updates, re-check `m_character_action_skills`, `m_ability_details`, character profiles/skins, tavern proposal cards, notices, and payment/shop text before publishing.
- New or changed characters require a full pass over normal skill, enhanced skill, ability, enhanced ability, awakening effect, limit break, and pure crystal text, including dynamic exact keys with resolved numbers.

## Character / Glossary QA

- `glossary.md` and `character-cards.md` do not conflict.
- Character names match the glossary across `names`, `titles`, `descriptions`, `outgame`, and `novels`.
- Character cards are applied only when the speaker is known.
- UI/system strings do not contain character-specific speech style.
- `おまんこ` / `まんこ` / `マンコ` are translated as `보지`; they do not remain as `자지`.
- `ミルティーユ` is always `밀티유`; `밀피유` and `미르티유` do not remain as active translations.
- `ミル` is translated as `밀티` only when it is clearly a nickname for `ミルティーユ`.
- `クルル` is always `쿠루루`; `크루루`, `크룰루`, and `쿠룰루` do not remain as active translations.
- `ルクスノヴァ` is always `룩스노바`; `루크스노바`, `럭스노바`, `루크스 노바`, and `럭스 노바` do not remain as active translations.
- `魔導炉` / `特殊魔導炉` is always `마도로` / `특수 마도로`; `마도 노심` and `마도노심` do not remain.
- `マリナ` dialogue uses `旦那様/旦那さま=나리` unless the source clearly uses another address; `단나사마`, `주인님`, `남편님`, `남편`, `여보`, `사장님`, and `당신` do not remain as active translations.
- `ベリサ` dialogue uses `兄さん/おにーさん=오빠`; never `형` or `형님`.
- `ちゃん` is not left as `쨩` unless intentionally approved for a specific character voice.
- `大穴` is always `어비스`; `대공`, `거대 구멍`, and `큰 구멍` do not remain as active translations.
- `司令官` / `指揮官` commander-address uses are translated as `사령관`/`사령관님`; `지휘관` does not remain as an active translation.
- Explicit source honorifics are preserved: `司令官殿=사령관공`, `司令官さん=사령관씨`. Do not flatten these to `사령관님`.
- `司令室` / `しれーしつ` location uses are translated as `사령실`; `지휘실` does not remain for these source terms.
