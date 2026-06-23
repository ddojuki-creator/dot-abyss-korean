# Tags And Placeholders

- Never change JSON keys.
- Translate JSON values only.
- Preserve file paths and file names.
- Preserve JSON syntax.
- Preserve placeholders exactly:
  `<user>`, `%user%`, `{0}`, `{1}`, `{name}`, `%s`, `%d`, `[name]`.
- Line-break controls (`<br>`, `\n`, `\r\n`, `\\n`) may be removed or consolidated for Korean layout.
- In `translations/novels`, final Korean dialogue may place one rendered line break independently of the Japanese source position when needed for the Korean dialogue window. Never use more than one rendered break per value.
- For non-novel UI/system text, do not increase rendered line breaks beyond the source unless a local rule explicitly allows it.
- Preserve HTML, TMP, and Unity Rich Text tags exactly:
  `<color=...>`, `</color>`, `<size=...>`, `</size>`, `<sprite=...>`, `<b>`, `<i>`, and similar tags.
- If a placeholder needs a Korean particle, attach the particle outside the placeholder.
