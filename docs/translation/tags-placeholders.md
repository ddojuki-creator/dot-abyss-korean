# Tags And Placeholders

- Never change JSON keys.
- Translate JSON values only.
- Preserve file paths and file names.
- Preserve JSON syntax.
- Preserve placeholders exactly:
  `<user>`, `%user%`, `{0}`, `{1}`, `{name}`, `%s`, `%d`, `[name]`.
- Line-break controls (`<br>`, `\n`, `\r\n`, `\\n`) may be removed or consolidated for Korean layout.
- In `translations/novels`, final Korean dialogue may place one rendered line break independently of the Japanese source position when needed for the Korean dialogue window. Never use more than one rendered break per value.
- Translation, review, and review-verification callers must use the same Korean-dialogue break policy. Do not reject a valid proposal merely because it removes, moves, or changes source line-break controls. Non-layout tags and placeholders remain protected.
- For non-novel UI/system text, do not increase rendered line breaks beyond the source unless a local rule explicitly allows it.
- Preserve HTML, TMP, and Unity Rich Text tags exactly:
  `<color=...>`, `</color>`, `<size=...>`, `</size>`, `<sprite=...>`, `<b>`, `<i>`, and similar tags.
- If a placeholder needs a Korean particle, attach the particle outside the placeholder.

## UI Copies With Color Tags

- Search all assigned domains for the exact source key after a shared UI correction. Outgame and static values can express the same text with different color wrappers. Different bytes do not prove that a copy is unrelated, and finding a plain-text copy does not mean its colored copies are already corrected.
- Inspect each affected stored path and its prior approval/hold before editing. Preserve that path's original tag tokens, color spans and placeholders; never overwrite a colored value with the plain outgame value. A previously approved or held path requires separately recorded impact handling, not new pending-review credit.
- For comparison evidence only, removing specifically verified color wrappers may demonstrate text equality. Limit this comparison to the exact source/path set, retain the original and final values, and verify all protected tags/variables separately. Do not normalize whitespace, other markup or placeholders to hide a mismatch, and do not save the stripped comparison value to the game dictionary.
- Record unreviewed unequal copies separately rather than approving them by similarity. Existing path-specific color diagnostics require concrete preservation evidence and their own notes, not a global warning exemption. Text equality does not prove in-game color, wrapping or clipping is correct.

## Novel Ruby Exception

- For `translations/novels`, this specific policy and `../../scripts/prompts/novels.md` override generic tag-preservation wording, including older translator prompts.
- For `<ruby=reading>base</>`, remove the ruby wrapper when it only supplies an unnecessary Japanese pronunciation. Translate the base normally. Example: `<ruby=しふ>師父</>` can become `사부님` when that address is established.
- When base and reading carry different meanings or intentional characterization, preserve the two-layer meaning and translate both into Korean. Do not replace the base with only the reading, and do not restore Japanese kana inside the attribute.
- Protect source keys and unrelated tags/placeholders exactly. Inspect ruby pairings and separate log controls such as `brlog` explicitly; a generic protected-token checker may not cover every tag. Do not treat log controls as disposable line breaks.
- Record the source, chosen treatment and saved value. Static validation and the semantic decision do not prove that the ruby renders correctly in the game.
