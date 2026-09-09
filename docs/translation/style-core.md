# Core Korean Translation Style

- Translate like a professional Korean localizer for Japanese 2D subculture games.
- Keep the meaning, mood, emotional temperature, and relationship dynamics of the source.
- Prefer natural Korean game dialogue over literal translation.
- Translate Japanese personal pronouns and conversational slang semantically instead of phonetically. Forms such as `アタシ`, `あたし`, `オレ`, and `俺` must become natural Korean first-person forms for the confirmed speaker, not `아타시` or `오레`.
- Rebuild lists and cause/effect relationships in Korean sentence order. A source comma or `<br>` must not produce false links such as making two separate mishaps read as one combined action.
- Do not summarize, omit, or invent story information.
- Keep recurring terms and character voices consistent across files.
- If context is limited, choose the most natural Korean game-text phrasing and preserve proper nouns conservatively.

## Korean Expression Review

- In dialogue and narration, use natural Korean counters and spacing: `한 방울`, `두 사람`, `세 번`. Do not mechanically retain forms such as `1방울` when the number is ordinary prose.
- Preserve exact quantities and distinguish prose counters from UI levels, ranks, IDs, dates, percentages, durations, and combat values. Do not apply a global digit-to-word replacement to either source keys or Korean values.
- Check particles, agreement, tense, negation, uncertainty, and the actor/recipient of each action across the whole sentence. Preserve intentional hesitation, but remove literal Japanese constructions only when the source meaning is unchanged.
- Do not rewrite an apparent source contradiction, typo, ambiguous pronoun, or suspected speaker error without evidence. Record the source, relevant context, and uncertainty; preserve deliberate misnaming and jokes.
- Font compatibility is not a vocabulary rule. Do not avoid `듀`, `앓`, or other Korean syllables on the assumption that the old font still applies. A reproduced glyph problem belongs in rendering QA, not an automatic synonym replacement.

## Line Layout

See the contextual checks below before shortening a line; a fluent sentence can still reverse its meaning.

- These are final-layout editing targets. First-pass translation may preserve additional source line breaks; a separate layout review will consolidate them.
- Prefer one line. Add a line break only when it materially improves meaning, dramatic timing, or readability.
- Use no more than two displayed lines per text value (at most one `<br>` or equivalent line-break control).
- Keep each displayed line at or below about 34 Korean characters whenever natural wording allows.
- For novel dialogue in `translations/novels`, ignore the Japanese line-break position when setting the final Korean layout. Reflow from the first Korean word, aim for around 34 characters per displayed line without splitting a word, then continue on the second displayed line.
- Treat 34 Korean characters as the normal target and 36 as the hard screen-risk limit for novel dialogue. Lines longer than 36 characters require reflow or manual shortening.
- The 36-character limit is a hard release gate and overrides older guidance or visual guesses that about 50 characters will fit. Run the layout audit before committing, while the novel files still appear in the changed-file set.
- Do not force a break merely to fill two lines. For non-novel UI/system text, do not add more line breaks than the source unless a local rule explicitly allows it.
- If the source has several line breaks, consolidate them into one or remove them unless their separation is contextually important.
- Do not damage grammar, character voice, tags, or placeholders just to meet the preferred 34-character length.
- If no faithful wording fits two lines within the 36-character limit, keep the meaning and record an unresolved layout issue. Do not remove information or add a third line to claim a pass; resolve and verify the affected display before release.
- Character-count checks are screening, not proof of on-screen fit. Verify variable-name expansion (including `<user>`), font size, wrapping, clipping, and overlapping text on the affected screen; record untested rendering separately.

## Contextual Meaning Checks

- Resolve `うち`, `こっち`, and omitted subjects from the confirmed speaker and surrounding dialogue. `うち` can mean the speaker's `나/내`, a household, or a group; never globally replace it with `우리/우리 집`. `こっちは` in a self-introduction need not refer to a place.
- Identify the function of a short response before translating it. `はい` can be an answer (`네`), a movement cue or exertion (`핫!`), or another contextual response. Do not transliterate an ordinary answer as `하이`, or apply the exertion example to every occurrence.
- Preserve who observes, judges, enjoys, worries, or receives an action. In particular, `楽しんでもらえない` can describe the audience not enjoying a performance, not the performer being unable to enjoy it. Reported questions must not become the speaker's own claims or questions.
- Distinguish praise from the response desired by a character: `すごい、がダメなの` in the dance story means that hearing only `대단하다` is insufficient, not that excellent dancing is forbidden. Resolve the omitted phrase from nearby lines.
- Distinguish repeated habits, completed actions, and future expectations. Do not turn a future victory into an already won contest, or a habitual pre-training meal into one specific past meal. Do not add `만` to `もう1回` unless the context limits it to one final attempt.
- Read idioms as expressions, not independently translated nouns: `恩に着せない` can be `생색내지 않다`; `調子がいい` may be teasing `참 말은 잘하네`, not physical wellness; `鬼気迫る` describes an intense, unsettling force, not smug self-confidence. These are contextual examples, not universal replacement pairs.
- Do not add unstated age, sexual experience, family ties, or destinations. `乙女` does not by itself assert virginity, and `帰る` does not always specify a house. A past childhood recollection is not proof of the character's present age.
- A plausible source typo may be interpreted only with evidence from adjacent dialogue or structured source records. Preserve the exact source key, document the evidence, and keep uncertainty unresolved when the intended meaning is not established.
- Before and after shortening, compare each clause: actor, action, recipient, condition, reason, comparison, and final predicate. Do not lose the end of a sentence, a list item, quoted words, or a motivation merely to fit the line width.
- Separate who pays, commissions, makes, gives, receives, permits, or is targeted. Read replies before resolving omitted subjects, passive forms, `てもらう`, `てくれる`, or `させてください`; receiving help must not become providing help, and commissioning work must not become doing it oneself.
- Distinguish a negative question from a positive rhetorical question (`じゃないですか`), a hope from a prediction, hearsay from firsthand knowledge, and an accusation or bluff from an established fact. Preserve a character's mistaken belief, deliberate wrong answer, wordplay, or role-playing rather than correcting the fictional facts.
- Track stage changes across episodes: student versus graduate, provisional permission versus formal enrollment, temporary postponement versus cancellation, and an offer versus a completed act. Match callbacks to earlier dialogue without merging distinct source keys.
- Keep exact source variants, including punctuation, spaces, LF/CRLF, cache variants, and apparent typos. Record each cache/line and do not declare a variant obsolete or a duplicate-display defect without runtime evidence. A `source-issue` annotation does not itself authorize an invented repair.
