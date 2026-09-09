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
- When invoked by a structured API review tool, return only its requested JSON schema. Direct review records and user-facing reports follow `final-review.md` and are not restricted to JSON.

## Context Traps From Reviewed Episodes

- Resolve the speaker inside a quotation separately from the current narrator. In a request to say `俺を命懸けで守れ`, `俺` belongs to the requested quotation; it need not refer to the person currently making the request. Check the reply before assigning who protects whom.
- Reconnect interrupted kana using particles and context before treating them as names. `みなと、協力、して` can mean `皆と協力して`; a pause alone does not establish a person named Minato. Likewise, a common noun with an honorific such as `大木さん` may address a large tree, not name a character. Do not turn these examples into global replacements.
- Preserve the distinction that makes a pun work. If dialogue contrasts `モラル` and `モラール`, retain an understandable sound contrast and their different meanings; translating each definition as a tautology destroys the exchange. Deliberate wrong names and answers remain deliberate.
- Check the actual noun rather than substituting a related phrase: `真剣` may mean a real blade, not `真剣勝負` (a serious contest). A plausible interpretation must still match the adjacent action and props.
- Translate short sounds by their dramatic function and event count. Distinguish an answer, exertion, surprise, crying, a creature's cry, and an impact. One `スパーン` strike must not become two strikes merely because a doubled Korean sound is familiar. Do not add intensity or a new action to explain the sound.
- For fractions and transfers, identify both the base amount and the direction: half of the total fee is not half of the deposit; `お酌` is pouring a drink, not receiving the cup. Check both the initiating line and its echoed reply without extending the correction to unrelated completed text.

## Additional Context Checks (2026-09-08)

- Spoken katakana can represent an ordinary phrase rather than a name. In the reviewed episode, `ヤセーノカン` represents `野生の勘` (야생의 감), not a person named 야세노칸. Confirm the surrounding action before transliterating; do not create a global replacement for every similar sound.
- Interpret idioms as a whole: `願ってもない` expresses something very welcome or better than hoped for, not an inability to wish for it. Preserve the sentence's positive or negative intent, not just its individual negative forms.
- Check comic exaggeration against the cast and the following payoff. `全ソフィアが号泣` and `全ベリサ` refer to a named individual's exaggerated reaction in this episode, not multiple copies of that character. Preserve the repeated joke and its escalation into the whole group crying.
- Preserve the scope of a claim. A character's previously unpossessed ability is not necessarily an ability absent from the entire original world. A conditional fear of feelings being exposed is not a statement that they have already been exposed.
- Check whether a name or title followed by `たち` means that person and their companions. `クルルたち` or `司令官たち` can mean `쿠루루네` or `사령관 일행`, rather than multiple people with the same name or title. Do not apply this reading to a genuine plural group without context.
- Read short connectors and interjections by their function in the exchange. Recollecting `そういえば`, reflective or topic-shifting `それにしても`, and reproachful `もう` must not acquire an unintended topic change, opposition, or time meaning through automatic `그나저나`, `그런데도`, or `이제` translations. Choose the Korean expression from the neighboring dialogue.

## Character Card Review

- When reviewing dialogue, check the speaker if the file path, key, or adjacent lines identify one.
- Apply the matching character card only to tone, speech level, address terms, and natural Korean phrasing.
- Do not rewrite a natural translation merely to make the character voice stronger.
- If a line has no confirmed speaker, do not apply a specific character card.
- If a character card and the source line conflict, the source line wins.
- Check the episode's current relationship and quoted speaker before enforcing an address or speech level. See `character-voice.md`; deliberate scene-specific switches are not inconsistency.
- If the existing Korean translation is accurate and natural, do not change it only because another phrasing sounds more characterful.
- Character cards are especially useful for address terms such as `旦那様`, `おにーさん`, `ご主人様`, `司令官`, but they must not override explicit source meaning.

## Review Execution

External API use is optional. Follow `direct-review.md` for direct Codex translation and a separate full contextual reread. Record actual coverage and final hashes; do not present self-review as an independent reviewer/model result. API quota failure alone is not a reason to halt this direct path. All content, layout, key coverage, and publication gates still apply.

For an already translated and first-reviewed batch, follow `final-review.md`. Start from the current Korean values and the previous review record; do not restart translation or equate a changed hash with proof that the earlier review never happened. Review duplicate occurrences using source order and speaker metadata, not JSON property order alone.

Under the 2026-09-06 completion-preservation decision, instruction supplements apply to unfinished work. Do not re-review completed translations just to apply the new guide version, and do not replace old receipts with newly signed approvals.
