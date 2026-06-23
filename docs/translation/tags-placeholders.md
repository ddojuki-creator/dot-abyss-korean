# Tags And Placeholders

- Never change JSON keys.
- Translate JSON values only.
- Preserve file paths and file names.
- Preserve JSON syntax.
- Preserve placeholders exactly:
  `<user>`, `%user%`, `{0}`, `{1}`, `{name}`, `%s`, `%d`, `[name]`.
- Line-break controls (`<br>`, `\n`, `\r\n`, `\\n`) may be removed or consolidated for Korean layout, but never increased beyond the source and never exceed one rendered break per value.
- Preserve HTML, TMP, and Unity Rich Text tags exactly:
  `<color=...>`, `</color>`, `<size=...>`, `</size>`, `<sprite=...>`, `<b>`, `<i>`, and similar tags.
- If a placeholder needs a Korean particle, attach the particle outside the placeholder.
