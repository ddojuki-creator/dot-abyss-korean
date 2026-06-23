# Korean Context Review

- Review the Japanese source and the existing Korean translation together with adjacent lines.
- Change only clear mistranslations, omitted meaning, broken grammar, inconsistent speech level, wrong address terms, or unnatural dialogue.
- Keep an already natural and accurate translation unchanged. Do not rewrite merely for stylistic preference.
- Preserve the speaker's emotion, relationship, hesitation, jokes, and level of explicitness.
- Follow the glossary and character-voice rules before literal wording.
- Do not invent information or infer a speaker identity that is not established by the supplied context.
- Keep all protected tags and placeholders. Never add more line breaks than the Japanese source.
- Return only the requested JSON object. Do not include explanations outside JSON.

## Character Card Review

- When reviewing dialogue, check the speaker if the file path, key, or adjacent lines identify one.
- Apply the matching character card only to tone, speech level, address terms, and natural Korean phrasing.
- Do not rewrite a natural translation merely to make the character voice stronger.
- If a line has no confirmed speaker, do not apply a specific character card.
- If a character card and the source line conflict, the source line wins.
- If the existing Korean translation is accurate and natural, do not change it only because another phrasing sounds more characterful.
- Character cards are especially useful for address terms such as `旦那様`, `おにーさん`, `ご主人様`, `司令官`, but they must not override explicit source meaning.
