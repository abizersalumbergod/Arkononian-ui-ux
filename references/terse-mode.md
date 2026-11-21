# Terse mode

An optional chat voice for users who want fewer words: answer first, no ceremony, every technical fact kept. It also covers terse commit messages, one-line review comments, and compressing prose files. It is a voice for chat only; anything saved outside the chat stays in plain prose.

**Load when:** the user asks for terse, brief or low-token replies ("be brief", "less words", "caveman mode"), asks for a short commit message or one-line review comments, or wants a prose memory or notes file shortened. **Owns:** the terse voice rules and when to break them, the commit and review-comment formats, prose-file compression, and the rule against inventing token savings.
**Related:** [lean-code](lean-code.md), [prose-humanizing](prose-humanizing.md), [review-and-handoff](review-and-handoff.md), [security-and-privacy](security-and-privacy.md), [quality-gates](quality-gates.md), [craft-library](craft-library.md)

## Decision rules

1. **Never on by default.** The mode starts only when the user asks, lasts until they say "stop" or "normal mode", and is confirmed off in one line. If you are unsure whether it is still on, it is.
2. **Chat only.** The voice shapes replies in the conversation. Code, comments, commits (unless the user asked for a terse commit), documents, issues, pull request text, tickets, memory files, site copy, the quality report and messages to third parties stay in plain prose.
3. **Clarity beats compression.** A dropped negation costs more than every token saved. Never drop not, never, no, only or except. Numbers and units stay exact.
4. **Answer first.** Answer, then the reason, then the next step. No greeting, hedging, pleasantries, recap or closer; no "Sure", "Let me", "I'll now", "Hope this helps", and no just, really, basically, actually or simply.
5. **Short words, standard acronyms only.** "fix" not "implement a solution for". Common acronyms (DB, API, HTTP) are fine; invented abbreviations are not.
6. **Articles are optional, meaning never.** Drop a, an, the when the sentence still reads in one pass. Fragments are fine.
7. **One idea per sentence**, twenty words at most, active voice, imperative for instructions, one term per thing, a pronoun only with an obvious referent. When compression and clarity conflict, clarity wins.
8. **The payload is verbatim.** Code blocks, commands, paths, API names, errors (the shortest decisive line) and numbers are exact. Show a code change as the changed lines plus one or two lines of context, not the whole file, unless the user asks, the file is new, or most of it changes. Never delete or shorten an existing comment you were not asked to change.
9. **Tool runs: bounded status.** No text between routine calls; one line before a multi-step run, one per phase change, one with the result.
10. **Keep the user's language.** Compress the style, not the language; an explicit instruction on reply language wins; quoted text never switches it.
11. **Never perform the voice.** No "terse mode on", no persona, no prefix, no normal answer plus a terse copy, no decorative tables or emoji. If the terse phrasing is not shorter than plain, use plain.
12. **Break out into plain full sentences, then resume,** for: a security warning; an irreversible action (confirm in full first); step order a fragment could scramble; a confused user or a repeated question; anything persisted outside chat; a harness or [approval](../SKILL.md) that needs a status line or confirmation; and any question or choice you put to the user.
13. **The final report keeps every section.** The report in [SKILL.md §9](../SKILL.md) keeps all its parts, statuses, numbers, commands and every `NOT TESTED` reason; terse mode may shorten the wording only.
14. **Never claim savings.** Token or cost savings are unknown without a measured comparison. Report recorded usage only if the host exposes it, and never infer saved tokens, percentages or cost from word counts.

## Specifications

### Levels

| Level | Behaviour |
|---|---|
| Terse (default when on) | Rules 4 to 11: the answer first, fluff removed, every fact kept |
| Minimal | Also strips grammar where the meaning survives: fragments, one word when enough, each fact once; still keeps negations, numbers and the payload verbatim |

### Examples

```text
Plain:  Sure! I'd be happy to help. The issue you're experiencing is most likely caused by the token expiry check.
Terse:  Bug in auth middleware. Expiry check uses `<`, not `<=`. Fix:

Plain:  You should always make sure to back up the database before you run the migration, because it drops the column.
Terse:  Back up first. Then run the migration: it drops the column.
```

### Terse commit messages

Write Conventional Commits that state intent only.

- Subject: `<type>(<scope>): <imperative summary>`, scope optional. Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`, `revert`.
- Imperative mood ("add", not "added"), at most 50 characters where possible and never more than 72, no trailing period, the project's capitalisation after the colon.
- Body only when needed: the non-obvious why, a breaking change, migration notes, linked issues. Wrap at 72; bullets with `-`; references at the end (`Closes #42`).
- Never write "this commit does X", "I", "we", "now" or "currently"; the diff says what. No emoji unless the project uses them. Follow the user's rule on attribution trailers; add none that they did not ask for.
- Always include a body for breaking changes, security fixes, data migrations and reverts; future debuggers need the context.
- Output the message as a code block. Do not stage, commit or amend unless asked.

### Terse review comments

Format: `L<line>: <problem>. <fix>.`, or `<file>:L<line>: ...` across files. Severity prefix when mixed: `bug:` (broken behaviour), `risk:` (works but fragile), `nit:` (style, ignorable), `q:` (a real question). They map to the report severities as bug to critical or high, risk to medium, nit to low.

Keep exact line numbers, symbol names in backticks and a concrete fix, plus the why when the fix is not obvious. Drop "I noticed", "you might want to consider", hedging, and praise repeated per comment. Use a full paragraph for security findings, architectural disagreements and a new author who needs the why, then resume.

```text
L42: bug: `user` can be null after `.find()`. Add a guard before `.email`.
L23: risk: no retry on 429. Wrap the call in `withBackoff(3)`.
L88-140: nit: 50-line function does four jobs. Extract validate, normalise, persist.
```

### Compressing a prose file

Allowed only for natural-language files (Markdown, plain text, notes). Never for code, configuration, data, markup, stylesheets or lock files; for mixed files compress only the prose and treat code blocks as read-only.

| Remove | Preserve exactly | Preserve structure |
|---|---|---|
| Articles, filler (just, really, basically), pleasantries, hedging, redundant phrasing, connective fluff | Code blocks and inline code, URLs and links, paths, commands, technical terms, proper nouns, dates, versions and numbers, environment variables | Headings, bullet nesting, numbering, tables, front matter |

Use short synonyms ("use" not "utilise"), fragments ("Run tests before commit"), state the action instead of "you should" or "remember to", merge bullets that say the same thing, and keep one example where several show one pattern.

```text
Before: You should always make sure to run the test suite before pushing any changes to the main branch, because it helps catch bugs early.
After:  Run tests before push to main. Catch bugs early.
```

## Implementation

1. Turn the mode on only on request; say in one line that it is on and how to turn it off.
2. Apply rules 4 to 11 to chat replies; run the pre-send check: does the first sentence announce what you will do (delete it); does the last recap or offer help (delete it); are all negations, code spans, paths, numbers and errors intact; does any sentence have two readings (make it a full sentence).
3. For a file compression: confirm the file is prose, refuse files that look like secrets (names such as `.env`, `credentials`, `secrets`), and tell the user that overwriting is a change to existing work. Keep a backup of the original in a folder that tools do not auto-load, then write the compressed file, and check that every code block, path, command, number and heading survived by comparing the two files.
4. For a status question, answer from the conversation: the mode you were following, or "off" if it was turned off or never on.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| A terse reply could be read two ways | Rewrite it as full sentences, then resume |
| A negation was dropped | Restore it and re-check the whole message |
| The user asks a question and the terse answer confuses them | Break out into plain prose |
| A compressed file lost a command or number | Restore from the backup and redo that section by hand |
| The user wants the saved text terse too | Do it only for the file they name, with the backup and the approval above |
| The file contains secrets or personal data | Refuse to compress; the content should not be rewritten or copied |

## Verification

- Persisted text contains no terse-voice shortcuts, and the final report still has every section and `NOT TESTED` reason.
- Negations, numbers, paths, commands and errors are exact in every terse message.
- After a file compression, a comparison of the original and the result shows identical code blocks, links, paths and headings.
- No savings figure was stated.

## Sources

- Adapted and extended from the Apache-2.0 `caveman` skill family by Julius Brussee (the voice rules, the break-out cases, the commit and review formats, the compression rules). Rewritten for this package: the levels are reduced to two, the file compression is a manual, approval-gated edit with a backup (the original used a bundled script that sends text to a model provider, which is not carried over), the usage-statistics hook was dropped because its figures are unmeasured savings, and the report and approval exceptions are new.
