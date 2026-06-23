# QA Checklist

- JSON parses successfully.
- Every translation file is a JSON object.
- `translations/manifest/ko_KR.json` is generated, not translated.
- Keys match upstream `zh_Hans.json`.
- Values are non-empty strings.
- Placeholders and non-layout tags are preserved; line-break controls follow the Korean line-layout policy.
- During final layout review, text normally uses one line, never exceeds two displayed lines, and aims for 35 characters or fewer per line.
- Novel dialogue ignores the Japanese line-break position during final layout. Reflow Korean from the first word, fill the first line up to the 35-character target without splitting words, and keep every displayed line at or below the 37-character hard limit.
- Non-novel line breaks are used only when context or readability requires them and are never added beyond the source count unless a local rule explicitly allows it.
- Character voice and speech level are consistent.
- UI text is concise.
- No invented setting, relationship, or emotion was added.

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
- `マリナ` dialogue uses `旦那様/旦那さま=나리` unless the source clearly uses another address; `단나사마`, `주인님`, `남편님`, `남편`, `여보`, `사장님`, and `당신` do not remain as active translations.
- `ベリサ` dialogue uses `兄さん/おにーさん=오빠`; never `형` or `형님`.
- `ちゃん` is not left as `쨩` unless intentionally approved for a specific character voice.
- `大穴` is always `어비스`; `대공`, `거대 구멍`, and `큰 구멍` do not remain as active translations.
- `司令官` / `指揮官` commander-address uses are translated as `사령관`; `지휘관` does not remain as an active translation.
