# Prototyping

Throwaway code that answers one design question. Two shapes: a logic prototype (a single self-contained page that anyone can click to feel a state model) and a UI prototype (several structurally different variations of one page, switchable in the browser). The question decides the shape; the prototype never becomes production code.

**Load when:** a state model, data shape or flow is unproven ("does this logic hold up?"), or the look and layout of a page is open ("what should this look like?"), and a quick artifact would settle it faster than discussion. **Owns:** choosing the branch, the rules shared by both, the variant switcher, the logic demo structure, what to keep and what to delete.
**Related:** [design-intelligence](design-intelligence.md), [visual-critique](visual-critique.md), [interaction-design](interaction-design.md), [test-driven-development](test-driven-development.md), [domain-model](domain-model.md), [interview-and-specs](interview-and-specs.md), [frontend-architecture](frontend-architecture.md)

## Decision rules

1. **The question picks the branch.** Logic, state or data shape: build a logic demo. Look, layout or hierarchy: build UI variants. If the question is ambiguous and the user is unreachable, choose by the surrounding code (a backend module means logic; a page or component means UI) and state the assumption at the top of the prototype.
2. **Throwaway from day one, and marked so.** Put it next to what it prototypes, named so a casual reader sees it is not production. In a UI project follow the existing routing convention; do not invent a structure.
3. **Trivial to run.** A UI prototype starts from one command in the project's own task runner. A logic demo is one HTML file that opens by double-click.
4. **No persistence by default.** State lives in memory. If the question is about storage, use a scratch store with an obvious "prototype, wipe me" name.
5. **Skip the polish.** No tests, no abstractions, no error handling beyond what keeps it runnable. The point is to learn fast.
6. **Surface the state.** After each action (logic) or each variant switch (UI), render the full relevant state so the change is visible.
7. **State the question first**, in the prototype itself, so a wrong question is visible before the work is wasted.
8. **Variants must differ in structure**, not colour: a different layout, information hierarchy or primary action. Three tweaked card grids are wallpaper. Default to three variants; cap at five. If two come out alike, redo one with an explicit constraint such as "no card grid".
9. **Prefer to host variants inside an existing page** (same route, a `?variant=` parameter, the real header, data and density) over an empty new page, which hides problems a populated page exposes. Use a new throwaway route only when no existing page can host it.
10. **Keep the logic portable.** In a logic demo the rules live in one pure module with no DOM access; the page is a thin shell over it, so the validated module can be lifted into the real code.
11. **Never wire a prototype to real mutations or a real database.** Read-only, or stubbed.
12. **Never promote prototype code directly.** Rewrite it properly when folding in the winner, under the project's standards and the gates.
13. **Capture the answer, then clean up.** Fold the validated decision into the real code, record the verdict and the question it settled (a design decision record), and remove the losing variants and the switcher from the main line. Offer to keep the full set on a throwaway branch as a primary source; create it only if the user agrees, and never push it.
14. **Gate the switcher.** It must be absent from a production build (check with the project's build, not by eye).

## Specifications

### Choosing the branch

| Question | Shape | Output |
|---|---|---|
| "Does this state machine handle X then Y?" "Can this data model represent Z?" "What should the API feel like?" | Logic prototype | One HTML file with a pure logic module, current-state panel, free-play buttons and guided scenarios |
| "What should this page look like?" "Show me options for this dashboard." | UI prototype | Three to five structurally different variants on one route, a floating switcher |

### UI prototype

1. Write the plan in one line at the prototype's location: "Three variants of the settings page on `/settings`, switched with `?variant=`."
2. Draft each variant against the page's purpose, its real data and the project's styling system, as separate exported components (`VariantA`, `VariantB`, `VariantC`).
3. Wire one switcher on the route; keep existing data fetching above it so only the rendered subtree changes:

```tsx
const variant = searchParams.get("variant") ?? "A";
return (
  <>
    {variant === "A" && <VariantA {...data} />}
    {variant === "B" && <VariantB {...data} />}
    {variant === "C" && <VariantC {...data} />}
    {process.env.NODE_ENV !== "production" && <PrototypeSwitcher variants={["A", "B", "C"]} current={variant} />}
  </>
);
```

4. The switcher is a small fixed bar at the bottom centre: previous, label (key plus a name when exported), next. It updates the URL with the framework's router so a variant is shareable and survives reload; the arrow keys also cycle, except while an input, textarea or editable element has focus; it looks clearly unlike the design under test; it lives in one shared component.
5. Hand over the URL and the variant keys. The useful feedback is usually a mix: "the header of B with the sidebar of C".
6. On a verdict: fold the winner into the real page and remove the other variants and the switcher from the main line.

### Logic prototype

Lay the single HTML file out top to bottom:

| Part | Content |
|---|---|
| Title and one-line question | What the demo lets you explore |
| Current state | The full relevant state as labelled fields (not a raw dump), re-rendered after each click, with what just changed called out |
| Free-play buttons | One per action, always available, any order |
| Guided scenarios | One tab per scenario: a plain description of the situation and what to watch for, then the ordered buttons to press; starting one resets to a known state |

Pick scenarios that expose the awkward cases: the happy path, a tricky edge, and an attempt at something that should be illegal. Write every label in the domain's language ([domain-model](domain-model.md)), not the code's. Keep it restrained: clean type, generous space, one accent colour, no animation. Choose the logic shape that fits the question: a pure reducer for discrete events, an explicit state machine when "which actions are legal now" is part of the question, a few pure functions when there is no implicit state, or a small module when the logic owns ongoing state.

## Implementation

1. Name the question and pick the branch (rule 1); write the question into the prototype.
2. Build to rules 3 to 6; for UI, host inside the real page where possible.
3. Open it and check it runs from one command (or one double-click) and that every variant or scenario renders.
4. Hand it over with the exact URL or file path; do not describe it instead of showing it.
5. After the verdict, record it in a [design decision record](../templates/design-decision-record.md), fold the winner into the real code, and delete the rest from the main line.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| Variants differ only in colour or copy | Redo with explicit structural constraints; that was a tweak, not a prototype |
| Variants share a layout component | Share only small parts such as a header; let each variant discard the layout |
| A variant needs to write data | Point it at a stub; the question is the look, not the backend |
| The logic module touches the DOM | Move that into the shell; the module must stay pure to be liftable |
| The switcher shipped in a build | Gate it on the environment and re-check the production build before delivery |
| No browser is available to view the variants | Say the look is `NOT TESTED`; verify only that each variant compiles and renders without errors |

## Verification

- The question is stated inside the prototype, and the verdict is recorded afterwards.
- Variants are structurally different (list how each differs in layout, hierarchy and primary action).
- The production build contains no switcher and no prototype route.
- Nothing from the prototype reached the main line except the validated decision.

## Sources

- Adapted and extended from the MIT-licensed `prototype` skill by Matt Pocock (the logic and UI branches, host-in-existing-page preference, the variant switcher, capture-and-clean-up rule). Rewritten for this package with the gate, approval and design-decision-record mapping added.
