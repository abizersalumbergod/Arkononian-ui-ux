# Conversion optimization

Raising the share of visitors who do the one thing a page exists for, without tricks: a page analysis in order of impact, form and sign-up design, overlays, post-sign-up activation, upgrade moments, pricing structure, lead magnets and free tools, offers with honest scarcity, and the psychology that explains why people decide. Every tactic here is bounded by accessibility and honesty.

**Load when:** a page, form, sign-up flow, overlay, pricing page or upgrade moment must convert better; a landing, pricing, checkout-entry or lead-capture page is being designed; the user says a page "isn't converting"; or a lead magnet, free tool or offer is planned. **Owns:** the CRO analysis order, form and sign-up rules, overlay rules, activation and upgrade principles, pricing structure, lead-magnet and free-tool selection, honest scarcity, the psychology limits, and the page-type checklists.
**Related:** [copywriting](copywriting.md), [measurement-and-tracking](measurement-and-tracking.md), [landing-page-engineering](landing-page-engineering.md), [interaction-design](interaction-design.md), [accessibility](accessibility.md), [positioning-and-research](positioning-and-research.md), [growth-channels](growth-channels.md), [security-and-privacy](security-and-privacy.md), [quality-gates](quality-gates.md)

## Decision rules

1. **No dark patterns, invented proof or accessibility regressions, whatever the goal.** "Conversion matters most" ranks at level 4 of [SKILL.md §2](../SKILL.md) and never overrides levels 1 to 3. That excludes fake countdowns, invented stock or demand, confirm-shaming decline text, pre-ticked consent, hidden costs, trick questions, and cancellation paths harder than sign-up.
2. **Diagnose before changing.** Establish the page type, the one primary goal, and the traffic context (organic, paid, email, social, direct). Then analyse in this order of impact: value proposition clarity; headline; call to action placement, copy and hierarchy; visual hierarchy and scannability; trust signals; objection handling; friction.
3. **Value clarity first.** A visitor should understand what this is and why they should care within about five seconds, in their own language, with one differentiated benefit rather than everything at once. A page fixed on a later dimension while this one fails is wasted work.
4. **One primary action per page,** visible without scrolling, with button copy that says what the visitor gets; a clear secondary action only if it does not compete; repeat the primary at decision points.
5. **Match the message to the traffic source.** The headline and offer on a landing page continue the promise of the ad, email or link that brought the visitor.
6. **Put proof where doubt arises:** near the call to action and after benefit claims; specific, attributed and real. Never invent logos, testimonials, counts or reviews ([copywriting](copywriting.md)).
7. **Every form field has a cost.** Ask only for what is needed to help the visitor now, collect the rest later (progressive profiling) or infer it. Three fields is the baseline; each field beyond costs completion, so justify it.
8. **Labels stay visible; placeholders show examples.** One question per field, conversational labels, logical order (easy first, sensitive last), a single column, proper input types and autocomplete attributes, tap targets large enough for touch ([accessibility](accessibility.md)).
9. **Validation helps, never punishes.** Validate when the visitor leaves a field, give specific fixes ("Enter an address like name@company.com"), keep their input, move focus to the first error, summarise several errors, and keep success and failure states clear ([interaction-design](interaction-design.md)).
10. **Value before commitment in sign-up.** Let people experience something before asking for an account where possible; require email (or phone) and password at most; offer social or passwordless sign-in prominently where it fits the audience; allow password paste and show requirements up front; defer company, role and phone unless needed; never block a real sign-up because an optional lookup failed.
11. **Overlays respect the visitor.** Trigger by intent (a click, scroll depth around a third to a half, exit intent on desktop, a back gesture on mobile), not by an early timer; show at most once per session with a cool-down after dismissal; exclude converted visitors and checkout flows; make closing obvious (a visible close control, an escape key, a polite "no thanks"); keep it keyboard-operable with a focus trap and restore focus on close; avoid full-screen interstitials before content on mobile because they hurt search and users. Use the native dialog element where it fits.
12. **Activate quickly.** After sign-up, design the minimum path to value: the fewest steps to experience enough value to make a confident decision; one goal per session; do the thing rather than show a tour; skippable guidance; empty states that offer a first action rather than a dead end.
13. **Define activation from evidence.** Judge it by lead-to-customer conversion and later retention, not sign-up volume. Find the early action that predicts retention with a defined cohort and windows, exclude behaviour from the outcome window, treat correlations as hypotheses, and confirm them on a later cohort; correlation alone does not prove that forcing the action causes retention.
14. **Upgrade moments follow value.** Ask after the visitor has experienced real value, explain why a feature is paid, show what it does, give early warnings before a trial ends, summarise value received, make continuing free easy, and respect the no.
15. **Prices are the owner's decision.** Propose structure, a value metric and a test plan; never present a specific figure as fact without data. Price between the next-best alternative and perceived value; cost is a floor, and a competitor's price is a data point, not a target. A first price is a bet to learn from: choose the order of magnitude that matches who is served (around ten, a hundred or a thousand a month for prosumer, team and business-critical tools), start near a round number, and avoid ultra-low prices that create false traction and are hard to raise.
16. **Honest scarcity only.** The constraint must be real and verifiable: capacity (slots per quarter), a cohort with a start date, founding pricing that actually rises, real inventory, a seasonal window, a bonus that really disappears, a scheduled price increase announced transparently. Countdowns end on a real date, after which the offer really ends; never reset a timer. If the scarcity is fake, take it off the page.
17. **Psychology is used to help people decide, not to trap them.** Mental models explain behaviour (jobs to be done, anchoring, social proof, loss aversion, framing, defaults, the effort-versus-value balance); apply them with the test: would the visitor be glad they were influenced this way once they understood?
18. **Test, do not assume.** Turn recommendations into hypotheses with a measurable outcome and hand them to the experiment process ([measurement-and-tracking](measurement-and-tracking.md)).

## Specifications

### Page-type checklists

| Page | Focus |
|---|---|
| Home | Positioning for cold visitors; a quick path to the most common conversion; serve both "ready to buy" and "still researching" |
| Landing | Message match; a single call to action (remove global navigation if possible); a complete argument on one page |
| Pricing | A clear plan comparison; the recommended plan obvious; answer "which plan is right for me?"; a visible path to start |
| Feature | Feature to benefit to outcome; use cases and examples; a clear path to try or buy |
| Blog or article | A contextual call to action matching the topic; inline actions at natural stopping points |

### Analysis output

| Group | Content |
|---|---|
| Quick wins | Easy changes with likely immediate effect |
| High-impact changes | Larger changes to prioritise |
| Test ideas | Hypotheses worth measuring rather than assuming |
| Copy alternatives | Two or three options with rationale for key elements ([copywriting](copywriting.md)) |

### Forms

| Field | Guidance |
|---|---|
| Email | One field, no confirmation field, validate format, suggest typo fixes, an email keyboard |
| Name | A single field unless personalisation needs a split |
| Phone | Optional where possible; if required say why; format as typed; country handling |
| Company or role | Defer, infer from the email domain, or use a short list |
| Message | Optional, with reasonable guidance |
| Choices | Radio buttons for fewer than about five options; searchable lists for many; an "other" field |

Multi-step forms suit more than five or six fields, distinct sections or conditional paths: show progress (step X of Y), start easy and end sensitive, one topic per step, allow back navigation, save progress, mark optional fields. Progressive commitment: email first, then detail, then qualifying questions. Submit button: `[action] + [what they get]`, immediately after the last field, with loading, success (clear next step) and error states. Near the form: a privacy statement, expected response time, risk reducers that are true ("no card required", "unsubscribe any time"). Contact forms: email or name plus message, response-time expectation, alternatives such as chat or phone. Demo requests: name, email and company; phone optional with a preferred-contact choice. Quote requests: multi-step, easy questions first. Measure start rate, completion rate, field drop-off, errors by field, time to complete and device split.

### Sign-up patterns

| Flow | Pattern |
|---|---|
| Business trial | Email and password (or single sign-on), then name and company, then onboarding |
| Consumer app | Social or email, then the product, profile completion later |
| Waitlist | Email only, optional use-case question, confirmation |
| Commerce account | Guest checkout by default, account creation optional after purchase |

After submit: a clear confirmation and next step; if verification is needed, explain it, make resend easy, mention spam folders, let the person change a wrong address, and consider delaying verification or offering a magic link. Name, trial length, card requirement, verification timing and single sign-on options are tests, not assumptions.

### Overlay types

| Type | Goal | Notes |
|---|---|---|
| Email capture | List growth | One field; state what they get and how often; consider an incentive |
| Lead magnet | Exchange content for email | Show a preview; deliver instantly |
| Discount | First purchase | A real, clear discount; once per visitor |
| Exit intent | Last-chance save | Acknowledge the departure; a different offer than on entry; no guilt |
| Announcement banner | Site-wide message | One message, dismissable, time-limited |
| Slide-in | Low-intrusion engagement | Does not block content; easy to minimise |

Click-triggered overlays convert best because the visitor asked for them. Copy: benefit-led headlines, first-person buttons ("Send me the guide"), decline text that is polite and neutral ("No thanks"), never manipulative.

### Pricing structure

| Axis | Question |
|---|---|
| Packaging | What is included at each tier (features, limits, support, access)? |
| Value metric | What do you charge for; does value grow as the customer uses more of it? Seats, usage, contacts or records, transactions, flat fee, credits or outcomes |
| Price point | The actual figure, between the next-best alternative and perceived value |

Good, better, best: a good entry tier, a better recommended tier that anchors, and a best tier that is a multiple of better. Differentiate tiers by features, limits, support or access. A pricing page should compare plans clearly, make the recommended one obvious, and answer the "which one" anxiety; keep it readable by people and machines (plain text prices and plan names, not only images).

### Lead magnets and free tools

| Type | Effort | Best for |
|---|---|---|
| Checklist, cheat sheet | Low | Quick wins and reference |
| Template (document, spreadsheet) | Low to medium | Repeatable workflows |
| Swipe file | Medium | Inspiration and examples |
| Guide, mini-course, quiz, webinar | Medium to high | Education, authority, segmentation |
| Calculator, generator, analyser, tester | Medium to high | Decisions involving numbers, quick creation, checking existing work |

A lead magnet solves one specific problem, matches the buyer's stage, looks worth paying for but takes under thirty minutes (ideally ten), leads naturally to the product, and is easy to consume on a phone. A free tool must solve a real problem, sit next to the core product, do one thing well, and be worth its cost (lead value times expected leads must exceed build and upkeep). Gated content and tracking follow [security-and-privacy](security-and-privacy.md) and need consent where required.

### Honest scarcity formats

| Format | Real constraint | Rule |
|---|---|---|
| Capacity | Slots you can deliver per period | Name the next opening date |
| Cohort | A start date and a closing date | State when the next cohort is |
| Founding price | The first N buyers pay less | Actually raise the price at N |
| Inventory | N units exist | Do not restock silently |
| Seasonal | A calendar window | Say what happens afterwards |
| Bonus expiry | A bonus ends on a date | Remove it on that date |
| Price increase | A scheduled rise | Announce transparently; honour earlier buyers |

## Implementation

1. State the page type, goal and traffic context; run the analysis in order and list findings with impact (high, medium, low) and a concrete fix.
2. Fix the highest-impact dimension first; for forms, audit field by field against rules 7 to 9; for overlays, specify trigger, targeting, frequency and conflict rules.
3. Build the changes with the states, labels and focus handling required by [interaction-design](interaction-design.md) and [accessibility](accessibility.md); verify with keyboard-only use and a small viewport.
4. Instrument the funnel events ([measurement-and-tracking](measurement-and-tracking.md)) and list the hypotheses to test, each with a primary metric and a guardrail.
5. Record claims and offers that need evidence as open items for the owner.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| The brief asks for urgency without a real deadline | Offer an honest alternative (the real constraint, or none) and name the evidence that would support urgency |
| An overlay blocks the keyboard or traps focus | Fix focus handling or remove the overlay ([accessibility](accessibility.md)) |
| Social proof is not available yet | Use specific product facts and process transparency; leave the proof slot out, never invent it |
| Conversion drops after a change | Check the funnel events and guardrails first; revert if the guardrail is significantly worse |
| A tool or enrichment step slows the form | Preserve valid submissions, bound the wait, and provide a useful fallback when the lookup is unknown |
| The owner wants a price recommendation | Give the structure and a test plan; say the figure needs their data |

## Verification

- Each recommendation names the dimension it addresses, the page's primary goal, and a hypothesis with a measurable metric.
- No fake timers, inventory, proof or confirm-shaming copy exists; every scarcity claim is verifiable.
- Forms have visible labels, correct input types, specific error messages, and work by keyboard; overlays close with a keyboard and restore focus.
- Pricing figures that appear are supplied by the owner.

## Sources

- Adapted and extended from the MIT-licensed `cro`, `signup`, `popups`, `onboarding`, `paywalls`, `pricing`, `lead-magnets`, `free-tools`, `offers` and `marketing-psychology` skills by Corey Haines (the analysis order, the form and sign-up principles, trigger and frequency rules, the activation and upgrade principles, pricing axes and first-price guidance, honest-scarcity formats). Rewritten and condensed for this package: the dark-pattern ban, the accessibility and consent bounds, the owner-decides-price rule and the evidence-based activation method are new; conversion figures and benchmarks in the originals were left out because they cannot be re-verified here.
