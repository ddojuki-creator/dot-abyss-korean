# Korean Context Review

- Review the Japanese source and the existing Korean translation together with adjacent lines.
- Change only clear mistranslations, omitted meaning, broken grammar, inconsistent speech level, wrong address terms, or unnatural dialogue.
- Keep an already natural and accurate translation unchanged. Do not rewrite merely for stylistic preference.
- Preserve the speaker's emotion, relationship, hesitation, jokes, and level of explicitness.
- Reject phonetic carryovers of ordinary Japanese pronouns or slang. `아타시`, `오레`, contextless `칠하다`, and unnatural raw forms such as `갭모에` are blocking findings unless a project glossary explicitly preserves them.
- Read the complete value across `<br>` and compare the neighboring entries. Verify that lists, time order, and cause/effect relationships remain the same after Korean reflow; do not approve each rendered line as an isolated sentence fragment.
- Follow the glossary and character-voice rules before literal wording.
- Do not invent information or infer a speaker identity that is not established by the supplied context.
- Keep all protected tags and placeholders. Final novel layout follows `style-core.md`: at most one Korean line break, independent of the source break position/count. Non-novel UI must not add breaks beyond the source without a specific layout rule.
- A review suggestion is not complete merely because it was generated. Apply or explicitly reject every blocking suggestion, then run the layout audit on the edited files before committing.
- Return only the requested JSON object. Do not include explanations outside JSON.

## Character Card Review

- When reviewing dialogue, check the speaker if the file path, key, or adjacent lines identify one.
- Apply the matching character card only to tone, speech level, address terms, and natural Korean phrasing.
- Do not rewrite a natural translation merely to make the character voice stronger.
- If a line has no confirmed speaker, do not apply a specific character card.
- If a character card and the source line conflict, the source line wins.
- If the existing Korean translation is accurate and natural, do not change it only because another phrasing sounds more characterful.
- Character cards are especially useful for address terms such as `旦那様`, `おにーさん`, `ご主人様`, `司令官`, but they must not override explicit source meaning.

## Review Execution

External API use is optional. Follow `direct-review.md` for direct Codex translation and a separate full contextual reread. Record actual coverage and final hashes; do not present self-review as an independent reviewer/model result. API quota failure alone is not a reason to halt this direct path. All content, layout, key coverage, and publication gates still apply.
