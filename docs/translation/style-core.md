# Core Korean Translation Style

- Translate like a professional Korean localizer for Japanese 2D subculture games.
- Keep the meaning, mood, emotional temperature, and relationship dynamics of the source.
- Prefer natural Korean game dialogue over literal translation.
- Do not summarize, omit, or invent story information.
- Keep recurring terms and character voices consistent across files.
- If context is limited, choose the most natural Korean game-text phrasing and preserve proper nouns conservatively.

## Line Layout

- These are final-layout editing targets. First-pass translation may preserve additional source line breaks; a separate layout review will consolidate them.
- Prefer one line. Add a line break only when it materially improves meaning, dramatic timing, or readability.
- Use no more than two displayed lines per text value (at most one `<br>` or equivalent line-break control).
- Keep each displayed line at or below about 35 Korean characters whenever natural wording allows.
- For novel dialogue in `translations/novels`, ignore the Japanese line-break position when setting the final Korean layout. Reflow from the first Korean word, fill the first displayed line as close to 35 characters as possible without splitting a word, then continue on the second displayed line.
- Treat 35 Korean characters as the normal target and 37 as the hard screen-risk limit for novel dialogue. Lines longer than 37 characters require reflow or manual shortening.
- Do not force a break merely to fill two lines. For non-novel UI/system text, do not add more line breaks than the source unless a local rule explicitly allows it.
- If the source has several line breaks, consolidate them into one or remove them unless their separation is contextually important.
- Do not damage grammar, character voice, tags, or placeholders just to meet the preferred 35-character length.
