# QA Checklist

- JSON parses successfully.
- Every translation file is a JSON object.
- `translations/manifest/ko_KR.json` is generated, not translated.
- Keys match upstream `zh_Hans.json`.
- Values are non-empty strings.
- Placeholders and non-layout tags are preserved; line-break controls follow the Korean line-layout policy.
- During final layout review, text normally uses one line, never exceeds two displayed lines, and aims for 35 characters or fewer per line.
- Novel dialogue ignores the Japanese line-break position during final layout. Reflow Korean from the first word, aim for around 34 Korean characters per displayed line without splitting words, and keep every displayed line at or below the 36-character hard limit.
- Every newly added `men_...` entry receives the same full contextual review as `hmn_...` and `hmr_...`; do not sample short character/home dialogue or leave first-person forms such as `アタシ` transliterated into Korean.
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
- `素股` / `スマタ` / `すまた` are translated as `스마타`; `스오마`, `스오마타`, `소마타`, `스타마`, `겉치기`, and `겉으로만 하는 코스` do not remain for those sources.
- `ミルティーユ` is always `밀티유`; `밀피유` and `미르티유` do not remain as active translations.
- `ミル` is translated as `밀티` only when it is clearly a nickname for `ミルティーユ`.
- `クルル` is always `쿠루루`; `크루루`, `크룰루`, and `쿠룰루` do not remain as active translations.
- `ルクスノヴァ` is always `룩스노바`; `루크스노바`, `럭스노바`, `루크스 노바`, and `럭스 노바` do not remain as active translations.
- `魔導炉` / `特殊魔導炉` is always `마도로` / `특수 마도로`; `마도 노심` and `마도노심` do not remain.
- `マリナ` dialogue uses `旦那様/旦那さま=나리` unless the source clearly uses another address; `단나사마`, `주인님`, `남편님`, `남편`, `여보`, `사장님`, and `당신` do not remain as active translations.
- `クレハ` dialogue/profiles/titles use `旦那様/旦那さま/旦那=서방님` even when the file is an event `evs_...` story; Marina's `나리` rule must not be applied to Kureha.
- `ベリサ` dialogue uses `兄さん/おにーさん=오빠`; never `형` or `형님`.
- `ちゃん` is not left as `쨩` unless intentionally approved for a specific character voice.
- `大穴` is always `어비스`; `대공`, `거대 구멍`, and `큰 구멍` do not remain as active translations.
- `司令官` / `指揮官` commander-address uses are translated as `사령관`/`사령관님`; `지휘관` does not remain as an active translation.
- Explicit source honorifics are preserved: `司令官殿=사령관공`, `司令官さん=사령관씨`. Do not flatten these to `사령관님`.
- `司令室` / `しれーしつ` location uses are translated as `사령실`; `지휘실` does not remain for these source terms.
- Skill/ability hit-count units keep source `HIT` as `HIT`. Do not translate them as `회 타격`, `히트`, or `타`.
- `ノックバック` is always `넉백`; `노크백` does not remain.
- Brothel/service `ドリンク` remains `드링크`, not `음료`.

## Character Ability / Limit-Break QA

- New character updates must check `translations/names`, `titles`, `descriptions`, `outgame`, `novels`, `another_name`, `ability_descriptions`, and generated `static`, not only the file where the first Japanese string was found.
- Cached novel IDs can include `evs`, `hmn`, `hmr`, `mas`, and `men`; all new files must be translated and included in manifest/cache.
- Main-story `mas_` IDs use a 10-digit numeric suffix, while most other novel IDs use 11 digits. The audit regex must support both; do not validate only by the `--cache-since` window because reused Unity `__data` files can have older modification times.
- Main-story dialogue may carry `mcv_` voice metadata while other dialogue uses `vc_`. Strip both before creating translation keys and fail QA if either metadata form remains in a source key.
- After opening a new chapter once, run an all-cache audit so every logged `mas_` scenario ID is present in the CDN and local `novels` cache.
- After playing newly added story content, inspect the runtime-collected `outgame-ja_JP.json` for mixed Korean/Japanese keys. Dynamic common popups can translate the changing quest title while leaving fixed Japanese suffixes; cover these with a `{[quest]}` template and verify all unlocked quest names, not only the first screenshot.
- Run `scripts/audit-runtime-balloons.mjs --fail-on-mixed` after opening new story/quest screens. It records `NovelRoot/WorldUICanvas`, `Exploration/.../TextBalloon`, and `Popup_QuestSelect/.../InfoNovel/TextBalloon` runtime paths and catches missing or mixed-language balloon entries.
- Full-cache story audits must include `dotmessage` world-balloon commands as well as `message`, `messageTextCenter`, and `l2dmessage`; checking only the latter three misses main-story speech balloons.
- Story QA must compare all dialogue `speaker` values and `charaload`/`objectload` name fields against `translations/names/ko_KR.json`, including ASCII/full-width and spacing variants such as `信者A` vs `信者Ａ`.
- Cache update reviews must inspect `.cache/game-cache-extract-report.json` `characterSpecSummary`. `m_ability_details` IDs do not include character IDs, so map them through `m_character_abilities` before deciding which character changed.
- Limit-break abilities usually have 3 abilities, each upgraded twice. Verify all 3 abilities across base, first-upgrade, and second-upgrade states, and check both exact keys and translated values.
- Limit-break/awakening ability cards must check combined `m_ability_details` field 4 + `【覚醒効果】` field 5 exact keys. A translated base skill and a translated awakening line are not enough if the runtime combined string is missing.
- Character bond reward messages are runtime-composed from `m_character_abilities` field 3 ability names. Verify both exact key patterns for every ability name: `「ability」の解放条件達成！` and `「ability」の最大Lvが10に上昇！`.
- Before auditing limit-break/awakening ability cards, run `scripts/sync-limit-break-ability-combos.mjs` if the script is present and relevant. It composes field 4 + field 5 exact keys from existing translations and creates plain numeric, green `<color=#4CF37B>` numeric, yellow `<color=#F4FF00>` numeric, and status-name color variants.
- Run `scripts/audit-character-ability-upgrade-matrix.mjs` to verify the base/first-upgrade/second-upgrade ability matrix has no missing translation keys, untranslated values, or Japanese leftovers.
- Run `scripts/audit-limit-break-ability-combos.mjs --all` for character updates. `missing`, untranslated, and Japanese-leftover counts must be 0.
- Check plain numeric, green numeric, and yellow numeric combinations such as `<color=#4CF37B>15%</color>`, `<color=#F4FF00>15%</color>`, `<color=#4CF37B>5%</color>`, and `<color=#F4FF00>5%</color>` because base-effect values and awakening values can both be colorized at runtime.
- Gacha shop / pickup character previews can render the same character skill and ability descriptions with yellow `<color=#F4FF00>` values, while normal character detail / upgrade screens often render green `<color=#4CF37B>` values. Treat both as separate exact keys.
- Check status-name color variants too: `紋章：情熱` can become `<color=#FF5050>紋章：情熱</color>`, and `紋章：衝撃` can become `<color=#6B8CFF>紋章：衝撃</color>`.
- Runtime exact keys can be mixed Korean/Japanese intermediate strings, not only pure Japanese source strings. If a key contains Korean text plus leftovers such as `上昇`, `【覚醒効果】`, `自身`, `会心`, `付与`, or `紋章`, register that exact key and translate the value fully.
- Subscription failure notices can be composed after the product name is translated. Cover `「{[product]}」の継続購入が行えなかったため解約しました。` with a dynamic template, retain collected mixed exact keys for compatibility, and verify the `通知` popup title separately.
- Check independent colorized count variants too, such as `【4】`, `【<color=#4CF37B>4</color>】`, and `【<color=#F4FF00>4</color>】`; a translated plain-count key does not cover colored-count keys.

## MasterData / Static QA

- When `Config/master.json` changes, rebuild the DLL and confirm the embedded resource remains `AbyssMod.config.master.json`.
- Compare every Japanese-bearing table in the latest game-cache snapshot against `Config/master.json`. A newly added table must fail the coverage audit until its real runtime class and translatable field names are verified from the updated client.
- Keep internal-only tables such as `m_serials` on an explicit allowlist instead of silently ignoring every unknown table.
- When source MasterData text changes, rebuild `translations/static/ko_KR.json`, keep `translations/static/ko_KR.missing.json` at `{}`, and update the manifest.
- Static and outgame can intentionally overlap, but conflicting values should be reviewed. Status-color differences for `문장: 열정` and `문장: 충격` are expected when static requires color tags.
- `m_ability_details.description` and `awake_description` must not have missing Korean values.
- `m_character_action_skills.name` and `description` must not have missing Korean values.
- `m_transition_tips.title` and `flavor_text` require layout review; `武器：拳` is `무기: 권`, not `무기: 주먹`.
