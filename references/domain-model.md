# Domain model

Keeping a project's language and its hard-to-reverse decisions written down while the work happens: a glossary of the product's own terms, short architecture decision records, and a record of requests that were deliberately ruled out. The same words then appear in code names, test names, UI labels and copy.

**Load when:** the product's terminology is fuzzy or overloaded, the user and the code use different words for the same thing, a decision is hard to reverse and likely to be questioned later, a request is declined and should stay declined, or a glossary or decision record is being created or edited. **Owns:** glossary format and rules, single and multi-context layout, the three-test rule for decision records, their format and numbering, and the out-of-scope record.
**Related:** [product-discovery](product-discovery.md), [interview-and-specs](interview-and-specs.md), [codebase-design](codebase-design.md), [test-driven-development](test-driven-development.md), [interaction-design](interaction-design.md), [copywriting](copywriting.md), [design decision record template](../templates/design-decision-record.md), [design brief template](../templates/design-brief.md)

## Decision rules

1. **Build the model actively.** Challenge terms against the glossary, sharpen fuzzy words, test relationships with concrete scenarios, and compare what the user says with what the code does. Merely reading a glossary for vocabulary is a one-line habit; this module is for when the model is changing.
2. **Write terms down the moment they resolve.** Update the glossary inline, one term at a time; do not batch.
3. **Call out conflicts immediately.** "Your glossary defines X as A, but you seem to mean B. Which is it?" Overloaded words ("account": the person or the login?) get a precise canonical term.
4. **Invent edge-case scenarios** that force the boundary between two concepts to be exact. Surface a contradiction between the user's statement and the code as a question, not a fix.
5. **A glossary is only a glossary.** No implementation detail, no scratch notes, no spec, no decisions. Define what a term is, in one or two sentences, never what it does.
6. **Be opinionated.** Where several words name one concept, choose one and list the rest under `_Avoid_`. Include only terms specific to this project's context; general programming ideas (timeout, retry, error type) do not belong.
7. **Create files lazily**: a glossary when the first term resolves, the decision folder when the first record is needed. Never create empty scaffolding.
8. **Offer a decision record only when all three hold**: it is hard to reverse, it would surprise a future reader without context, and it is the result of a real trade-off between genuine alternatives. If any is missing, skip it.
9. **Keep records short.** A decision record can be one paragraph; its value is that the decision and the reason exist, not the headings filled in.
10. **Rejected requests are recorded once per concept**, with a durable reason (scope, a technical constraint, a strategic choice), and matched by meaning, not keyword. A temporary reason ("not now") is a deferral, not a rejection.
11. **The glossary drives the product's words everywhere**: component and route names, test names, form labels, empty states, error messages and page copy use the same term, so a visitor never meets two names for one thing ([interaction-design](interaction-design.md) microcopy).
12. **Design decision records and architecture decision records differ.** A design decision record ([template](../templates/design-decision-record.md)) captures a choice made during a build, including rejected advice. An architecture decision record outlives the build and is for hard-to-reverse, surprising, trade-off decisions. Link one from the other; never duplicate.

## Specifications

### Layout

```text
GLOSSARY.md                 single-context repos: one glossary at the root
docs/adr/0001-slug.md       decision records, numbered in sequence
.out-of-scope/concept.md    one file per rejected concept
GLOSSARY-MAP.md             only when there are several contexts; lists them and how they relate
src/<context>/GLOSSARY.md   a context's own glossary (and its own docs/adr/ for context-specific decisions)
```

Infer the structure: a `GLOSSARY-MAP.md` means several contexts; a root glossary alone means one; neither means create the root glossary at the first resolved term. With several contexts, infer which one the topic belongs to and ask if unclear.

### Glossary format

```md
# {Context name}

{One or two sentences on what this context is and why it exists.}

## Language

**Order**:
A request from a customer to buy specific products.
_Avoid_: Purchase, transaction

**Customer**:
A person or organisation that places orders.
_Avoid_: Client, buyer, account
```

Group terms under subheadings only when natural clusters appear. A map lists each context, where it lives, and a relationships list such as "Ordering emits OrderPlaced; Fulfilment consumes it".

### Decision record format

```md
# {Short title of the decision}

{One to three sentences: the context, what was decided, and why.}
```

Optional, only when they add value: a status line (`proposed`, `accepted`, `deprecated`, `superseded by ADR-NNNN`), considered options when the rejected alternatives are worth remembering, and consequences when downstream effects are not obvious. Number by scanning the folder for the highest existing number and adding one.

What qualifies: architectural shape; how contexts integrate; lock-in technology choices (database, auth provider, hosting target), not every library; boundary and scope decisions, including the explicit no; deliberate deviations from the obvious path (manual SQL instead of an ORM, and why); constraints invisible in the code (compliance, a partner's response-time contract); and non-obvious rejected alternatives, so the same suggestion is not made again in six months.

### Out-of-scope record

```md
# Dark mode

This project does not offer user-facing theming.

## Why this is out of scope
{A substantive, durable reason: scope, a technical constraint or a strategic choice.}

## Prior requests
- "Add dark mode support"
- "Night theme for accessibility"
```

Write it only when an enhancement is rejected, never when something is closed because it already exists (point to where it lives instead). When a new request resembles a record, surface the earlier decision and let the owner confirm (add the request to the list), reconsider (update or delete the file) or disagree (treat as distinct).

## Implementation

1. Read `GLOSSARY.md`, `GLOSSARY-MAP.md` and the decision folder if they exist; note terms the brief or code already use.
2. While interviewing ([interview-and-specs](interview-and-specs.md)) or designing ([codebase-design](codebase-design.md)), apply rules 3 to 5 and write each resolved term immediately.
3. At a decision point, run the three-test check; offer a record only when all hold, and write it in the project, not in the skill folder.
4. Name components, routes, tests and labels from the glossary; list the terms used in the design brief so copy and code agree.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| The user disagrees on a term | Record both under one canonical entry with `_Avoid_` for the loser; the user's choice wins |
| The glossary grows implementation detail | Move the detail to code comments or a decision record; keep definitions to what a thing is |
| Decision records pile up for easy choices | Apply the three tests; delete records for reversible, unsurprising decisions |
| A rejected request keeps returning | Check the out-of-scope folder first; if the reason is no longer durable, delete the file and triage normally |
| No write access or a read-only repo | Keep the glossary in the scratch directory and say where it is |

## Verification

- Each new term is in the glossary with its `_Avoid_` list, and the code, tests and UI labels use the canonical term.
- Every decision record satisfies the three tests and is linked from the matching design decision record, if any.
- No glossary entry contains implementation detail.

## Sources

- Adapted and extended from the MIT-licensed `domain-modeling` skill and the out-of-scope record of the `triage` skill, both by Matt Pocock: the glossary rules, the three-test rule and format for decision records, lazy file creation, and the out-of-scope record. Rewritten for this package, with the link to design decision records and the UI-label rule added.
