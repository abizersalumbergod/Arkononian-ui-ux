# Interview and specs

How to turn a loose idea into something buildable: an interview that walks the decision tree in rounds with a recommended answer on every question, a questionnaire for someone who holds knowledge you lack, a spec written from what is already known, tickets cut as thin end-to-end slices with explicit blockers, and agent briefs that stay true while the code changes.

**Load when:** the brief has many or risky assumptions, the user wants their plan stress-tested, a decision needs input from another person (a client, an owner, a lawyer), a spec or ticket set is being written, or work must be handed to someone else to build. **Owns:** the interview protocol (design tree, frontier, rounds), the re-pitch, the questionnaire, the spec template, ticket slicing and blocking edges, the agent brief, and where these artifacts live.
**Related:** [product-discovery](product-discovery.md), [domain-model](domain-model.md), [codebase-design](codebase-design.md), [test-driven-development](test-driven-development.md), [prototyping](prototyping.md), [delivery-orchestration](delivery-orchestration.md), [design brief template](../templates/design-brief.md), [security-and-privacy](security-and-privacy.md)

## Decision rules

1. **Interview only when it pays.** [SKILL.md §1](../SKILL.md) rule 8 still holds: ask only when the answer changes architecture, business logic, safety or the design direction. Use the interview for a vague, large or risky brief; for a small task, assume, record the assumption and go.
2. **Map the decisions as a tree.** Every decision branches into the decisions that hang off it. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask now without guessing at answers you have not heard.
3. **Ask the whole frontier in one round**, numbered, each with your recommended answer, worded so that "yes" accepts it. Then wait. A question that depends on another open question in the same round belongs to a later round.
4. **Recompute after every round.** Answers move the frontier outward and unblock questions that depended on them. The interview is done when the frontier is empty, every branch has been visited and nothing is silently assumed. Do not act on it until the user confirms the shared understanding.
5. **Facts are your job; decisions are the user's.** Look up anything the environment can tell you (the repository, the configuration, the tools) instead of asking, and do not block the rest of the frontier on the lookup. Never answer a decision question on the user's behalf.
6. **Use the project's language** and respect recorded decisions in the area ([domain-model](domain-model.md)); sharpen terms and update the glossary as they resolve.
7. **Re-pitch when a message did not land.** Give a little context, then say it in plain technical English: sentences of twenty words or fewer, active voice, one term per thing, the project's glossary words.
8. **For knowledge someone else holds, write a questionnaire; grill the send, not the subject.** Ask the user only about the send (who it goes to, what you need back); the questions in the document then target the gap between what the recipient knows and what the user needs.
9. **Write a spec by synthesis, not a second interview.** Use what the conversation and the codebase already hold. Sketch the seams at which the feature will be tested first (existing seams over new, the highest seam that works, ideally one) and check them with the user ([test-driven-development](test-driven-development.md)).
10. **A spec avoids file paths and code snippets,** which go stale. The exception: a snippet from a prototype that encodes a decision more precisely than prose (a state machine, a reducer, a schema, a type shape); trim it to the decision-rich part and say it came from a prototype.
11. **Cut tickets as tracer bullets.** Each slice is a narrow but complete path through every layer (content, design, markup, behaviour, data, tests), demoable or verifiable alone, and sized to fit one fresh working session. Do any prefactoring first: make the change easy, then make the easy change.
12. **Every ticket declares what blocks it.** A ticket with no blockers can start now. Iterate the breakdown with the user on granularity, blocking edges, merges and splits until they approve it.
13. **A wide refactor is the exception to vertical slicing.** One mechanical change whose blast radius spans the codebase (a rename, a retype of a shared symbol) is sequenced as expand, migrate, contract: add the new form beside the old; migrate callers in batches sized by blast radius, each batch its own ticket blocked by the expand; delete the old form in a ticket blocked by every batch. When batches cannot stay green alone, let them share an integration branch and block a final integrate-and-verify ticket.
14. **An agent brief is the contract.** It stays durable (describe interfaces, types and behavioural contracts, never file paths or line numbers), behavioural (what, not how), complete (acceptance criteria that are each independently verifiable) and bounded (an explicit out-of-scope list).
15. **Artifacts are files first.** Write specs, tickets and questionnaires into the project (for example `docs/specs/`, or a scratch folder `.scratch/<feature-slug>/`), one file per ticket, numbered in dependency order. Publishing to an issue tracker, or sending a questionnaire anywhere, is an external action: ask first, naming the action and the destination ([SKILL.md §1](../SKILL.md)). Never close or edit a parent issue unasked.
16. **No private data in artifacts that leave the machine.** Redact keys, personal data and unreleased client names before anything is shared.

## Specifications

### Interview round format

```text
Q1 - <question title>: <question body, with options when there are choices>
Recommended: <your recommended answer>

Q2 - <question title>: <question body>
Recommended: <your recommended answer>
```

### Questionnaire template

```md
# <Questionnaire title>

Purpose: why this exists and the decision riding on it.
From: <the user>   To: <the recipient>   How your answers will be used: <where they go>

## Context
One paragraph for a recipient who was not in the user's head. Enough to answer well, not a page.

## How to answer
Deadline and rough effort. Partial answers and "I don't know" are useful; flag doubt instead of skipping.

## <Theme>
### <One idea per question, most important first>
Why this matters: <one line, only where the question could be misread or invite a throwaway answer>

>

## Anything else?
Anything we did not ask that we should know?
```

Typical site uses: collecting a client's real copy, proof and legal text, brand assets and licences, analytics and domain access, content owners per page. Ask for access by name, never for secrets pasted into a document.

### Spec template

```md
## Problem statement
The problem from the user's perspective.

## Solution
The solution from the user's perspective.

## User stories
A long, numbered list covering every aspect of the feature:
1. As a <actor>, I want <feature>, so that <benefit>.

## Implementation decisions
Modules built or changed and their interfaces, architecture and schema decisions, API contracts, specific interactions, and technical clarifications from the owner. No file paths or code.

## Testing decisions
What a good test is here (external behaviour only), which modules are tested at which seams, and prior art in the codebase.

## Out of scope
What this spec deliberately leaves out.

## Further notes
```

For a site: the actor is a visitor or an editor; the stories include states (loading, empty, error, offline), accessibility and content ownership, not only the happy path.

### Ticket template (one file per ticket)

```md
# <NN>: <ticket title>

What to build: the end-to-end behaviour this ticket makes work, from the user's perspective, not a layer-by-layer list.
Blocked by: the numbers and titles that gate this ticket, or "None (can start immediately)".
Status: ready-for-agent

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2
```

Example slice for a pricing page: "A visitor sees three plans with monthly prices, toggles to annual, sees the updated prices and the saving, and the call to action of the chosen plan leads to sign-up", with criteria for keyboard operation, the no-JavaScript fallback and the price source.

### Agent brief template

```md
## Agent brief

Category: bug | enhancement
Summary: one line on what must happen

Current behaviour: what happens now (for a bug, the broken behaviour; for an enhancement, the status quo it builds on).
Desired behaviour: what should happen after the work, including edge cases and error conditions.

Key interfaces:
- `TypeName`: what changes and why
- `functionName()` return type: what it returns now and what it should return

Acceptance criteria:
- [ ] A specific, testable criterion
- [ ] Another

Out of scope:
- Something adjacent that must not change here
```

A bad brief names files and line numbers, says "fix the thing", lists no criteria and sets no boundaries.

## Implementation

1. Read the brief, the glossary and the decision records first; look up the facts you can find yourself.
2. Run rounds (rules 2 to 5) until the frontier is empty; capture assumptions and answers in the [design brief](../templates/design-brief.md).
3. For a hand-off or a build in several sessions, write the spec, then the tickets (rules 9 to 13), then agent briefs for tickets that will be built by someone else; save them as files and confirm the breakdown with the user before treating it as final.
4. Build from them with [delivery-orchestration](delivery-orchestration.md).

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| The user is unreachable | Do not interview. Record the assumptions with the most conservative reading and continue |
| A round is too long to answer | Ask only the questions whose answers change the next step; keep the rest as assumptions |
| The user answers a recommendation with "yes" to everything | Read it back as a short list of decisions and confirm once before acting |
| A ticket is too big for one session | Split it by slice, never by layer |
| A slice cannot be demoed alone | It is a horizontal cut; reshape it to a thin end-to-end path |
| The brief names files that have moved | The brief was not durable; rewrite it in terms of interfaces and behaviour |
| The tracker is unavailable or not approved | Keep the artifacts as files and say where they are |

## Verification

- The interview ended with an empty frontier and a confirmed summary, or the assumptions are listed in the brief.
- Every spec uses glossary terms, contains no file paths, and names its seams and out-of-scope list.
- Every ticket has blockers (or "none"), acceptance criteria that can each be checked, and fits one session.
- Nothing was published or sent without an approval naming the action and the destination.

## Sources

- Adapted and extended from the MIT-licensed `grilling`, `grill-me`, `grill-with-docs`, `wait-what`, `to-questionnaire`, `to-spec`, `to-tickets` and `triage` (agent brief) skills by Matt Pocock: the design-tree and frontier rounds, the questionnaire, the spec and ticket templates, expand-migrate-contract sequencing and the durable agent brief. Rewritten for this package with site-specific examples, the approval rules and file-first artifacts added; the round format uses plain labels in place of emoji.
