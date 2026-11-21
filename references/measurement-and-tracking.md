# Measurement and tracking

Knowing whether a site works: a tracking plan built from the decisions it must inform, conversion tracking that fires on confirmed success and is proven to arrive, attribution read as directional rather than true, and experiments designed so their results can be trusted. Every number is computed, dated and scoped to what was actually checked.

**Load when:** analytics, events, tags, pixels, conversion APIs, consent-aware tracking or UTMs are set up or audited; a conversion drops or "does not match"; channels claim credit for the same sale; an A/B test or experiment program is planned; or a report states results. **Owns:** the tracking plan and event rules, the conversion-tracking rules and verification discipline, the verdict rules for mismatched numbers, attribution models and reconciliation, and experiment design and analysis.
**Related:** [conversion-optimization](conversion-optimization.md), [seo-and-discoverability](seo-and-discoverability.md), [launch-and-distribution](launch-and-distribution.md), [growth-channels](growth-channels.md), [security-and-privacy](security-and-privacy.md), [frontend-architecture](frontend-architecture.md), [quality-gates](quality-gates.md), [performance](performance.md)

## Decision rules

1. **Adding analytics, pixels or tracking scripts is an approval point.** It sends visitor data to a third party and loads third-party code ([SKILL.md §1](../SKILL.md)). Ask first, naming the vendor, the data sent and the consent behaviour; honour consent before the first tag fires, and do not ship tracking that bypasses it ([security-and-privacy](security-and-privacy.md)).
2. **Track for decisions, not data.** Every event answers a question and informs an action; start from the questions and work backwards. Avoid vanity metrics; clean data beats more data.
3. **Name things consistently and write it down.** Object-action, lowercase with underscores (`signup_completed`, `cta_hero_clicked`); detail goes in properties, not in the name; keep provider-defined names for automatic or recommended events and map your internal names to them explicitly, because naming an event does not make a provider collect it.
4. **No personal data in event properties.** Use identifiers the privacy policy covers; hash and consent-gate anything sent to ad platforms.
5. **Compute, do not eyeball.** Derive every total, rate and delta from row-level data with a script or spreadsheet, cross-check each headline figure a second independent way, and report a single segment's own numbers rather than folding it into its group.
6. **Match observation windows.** A rate divides a numerator and a denominator over the same closed window; never divide a full period's spend by a partial period's results. A cohort still inside its window is pending, not failed: exclude it from the denominator and label it.
7. **Recommend against the stated goal.** Analysis ends in a recommendation argued from the goal in the brief, naming what each option serves and what it trades away.
8. **Fire a conversion on confirmed success, never on the attempt.** A submit click counts failed validation and bots; a thank-you page needs a guard against refreshes and direct visits; a purchase is the confirmed order, not the start of checkout. Count the same real-world action once.
9. **A tag firing is not a conversion arriving.** Preview proves the tag executed; only the destination proves receipt. Verify both and report them separately. If a test conversion can safely be fired, the job is not done until one demonstrably arrived; if it cannot, say plainly what remains unverified.
10. **Say how you know.** Label each finding observed (you saw it in fetched HTML, a network request or a platform screen), reported (the user told you) or inferred (you reasoned to it). Never write "observed" for something inferred; never cite a source you did not open.
11. **A symptom is a request for a diagnosis, not a mandate to change anything.** Find the cause, report it, name the exact change, and stop to ask. "I could not find the cause" is a valid finding; inventing one is not. List what was ruled out and the one next step that would settle it.
12. **Never act on a live site or advertising account the user has not named in this conversation,** and remember a real test submission fires a real conversion into real reporting: it needs the exact URL and a yes in the same turn. Publishing a tag-manager container is the same class of action.
13. **Absence of a browser tag is not absence of tracking.** Server sends, native integrations and offline imports leave nothing in the page source; ask what already sends conversions before adding a sender, since a second sender is how double counting starts.
14. **Static analysis cannot say "this works."** From a page and a published container the most you can say is that no fault is visible; scope every verdict to what you actually checked.
15. **Attribution is directional, not truth.** Every model is an opinion about whose story to believe; the sum of channel-reported conversions almost always exceeds real conversions. Count real conversions once, deduplicated against one source of truth (usually the backend or CRM), and explain platform credit separately. Never sum across platforms.
16. **Experiments start from a hypothesis and one change,** with the sample size fixed beforehand, a primary metric tied to business value, secondary metrics for context and guardrail metrics that stop the test if they get worse. Do not peek and stop early; do not change variants mid-test; do not extend a finished test until it becomes significant.
17. **Statistical significance is not business value.** Report the effect size and its interval next to the p-value, check it against the smallest effect worth detecting, label unplanned segment findings exploratory, and confirm them in a new test.

## Specifications

### Tracking plan

| Event | Category | Properties | Trigger | Notes |
|---|---|---|---|---|
| `cta_clicked` | Action | button_text, location | Click on a primary call to action | Intent, never a conversion on its own |
| `form_submitted` | Conversion | form_type | Confirmed success of the form | Not the button click |
| `signup_completed` | Conversion | method, source | Account created | Map to the provider's recommended `sign_up` |
| `purchase_completed` | Conversion | plan or items, value, currency | Confirmed order | Value rules below |

Standard properties: page (title, location, referrer), user (an internal id, type, plan), campaign (source, medium, campaign, content, term), product (id, name, category, price). Campaign parameters are lowercase and consistent, and documented in the plan. Marketing-site events: cta, form, signup, demo request. Product events: onboarding step, feature used, purchase, cancellation with reason. Setup order for a standard analytics property: create the property and data stream, install the tag (directly or through a tag manager), enable the automatic measurement, configure the custom events, mark the conversions.

### Conversion kinds

| Kind | Hard part | Watch for |
|---|---|---|
| Lead generation (form, booking, chat, call) | The browser is often the only place success is visible, and every tool signals it differently | Hooking the attempt instead of the outcome; a custom form whose success branch has no tracking call |
| Commerce (purchase, subscription) | The order record exists, so the conversion is easy to confirm; correctness is the work | Value (tax and shipping in or out, currency), item data matching the product feed, browser and server events deduplicated, the pre-purchase events flowing, refunds |

Anti-patterns to push back on before building: button clicks as conversions; pricing-page views set as a primary conversion (it teaches bidding to buy browsers, not buyers); one real action counted by two conversion actions; lead forms counting every submission instead of one per lead. A soft signal the owner still wants is recorded as secondary so it never drives bidding.

### Setup and audit flow

1. Pin three facts, from evidence first and one batched question for what is left: what counts as a conversion (precisely), where it must land, and what runs the moment (the form, booking, chat or checkout tool, the platform, whether a tag manager exists). Always ask whether anything already sends conversions from a server or a native integration.
2. Work out how the moment signals success (the tool's real success event, the submit handler read directly, the platform's confirmed-order surface for commerce; a server-originated event when only the backend knows).
3. Choose the delivery path on stated criteria: the platform's native integration first where it covers the destination (and name its gaps); browser-side tags (free, with the identity-matching options configured and consent respected); server-side as a spectrum (your own calls to the platform interfaces, a self-hosted server container, managed tools), compared on what data travels, whether delivery is observable and who can build it. Say in a sentence that server-side exists when the browser-side loss bears on the question; do not append tool names to a request that did not ask about delivery. Visitors who decline tracking are counted by no method and must not be.
4. Build it with consent first; verify (below); hand over with the identifiers used, the event names, how to re-verify in five minutes, the loss to expect, and what is likely to break it later (a form plugin update, a consent banner change, an announced platform deprecation).
5. For an audit, route on the symptom: gather static evidence (the page, the published container), classify how the moment fires, walk the click-identifier chain, then guided account checks. Every check resolves to pass, fail, unknown or not applicable; an unknown lowers evidence coverage but never counts against health, because "I could not check" and "it is broken" are different findings.

### Symptom routing

| Symptom | Suspect first |
|---|---|
| Never tracked anything | A missing or mis-wired tag; then classify the moment |
| Worked, then stopped | Date the break; check platform-wide changes and what changed that week |
| Spend and clicks, no conversions | The click-identifier chain, link by link |
| Analytics and the ad platform differ | Usually nothing: read the verdict rules |
| Far too many conversions | Duplicate senders, every-versus-one counting, thank-you page refreshes |
| Leads arrive, the platform shows nothing | A capture gap: classify the moment, then the identifier chain |
| Conversions record, bidding ignores them | Primary versus secondary, inclusion settings, campaign goal setup |
| Some arrive, far from all | Inventory every entry point, then structural loss |
| Reported leads are junk | The wrong moment: firing on clicks or validation |
| Revenue numbers wrong | Value integrity: tax, shipping, currency, refunds |

### Verdict rules for mismatched numbers

| Observation | Reading |
|---|---|
| Analytics and an ad platform differ by roughly 10 to 30 percent | Normal: different counting, attribution and dates |
| A gap well above that, a direction flip, a sudden change in a stable gap, or a platform at exactly zero | Investigate |
| The last three days | Lie: conversions post against click dates and lag by up to about 72 hours |
| Any two numbers | Line up the conversion action, date basis, time zone, attribution window and campaign scope first; thresholds trigger triage, not verdicts |

### Verification discipline

Verify what is in reach and record it as observed (the test entry, the event appearing exactly once, the tag firing in preview, the network request leaving the page). For what is out of reach, give the user a named check with an expected result ("submit a test with this marker email, open the platform's test-events view, expect one lead within a minute, tell me what you see"); their answer is recorded as reported. Use the instant surfaces (debug views, test-event tools) rather than waiting a day on a delayed report. Test with an identifiable marker, never real personal data, from a real browser on the real page; a fabricated click identifier tests transport only and proves nothing about attribution. Close with a status: built, installed, firing confirmed, arrival confirmed, or arrival pending with the one check that closes it.

### Attribution models

| Model | Credit rule | Best for | How it lies |
|---|---|---|---|
| First touch | All to the first known touch | Top-of-funnel value, short cycles | Ignores what closed the deal |
| Last touch | All to the final touch | Direct response, quick purchases | Over-credits branded search and direct; ignores demand creation |
| Last non-direct | All to the last touch, skipping direct | A cheap fix for direct pollution | Still single-touch |
| Linear | Equal to every touch | Long journeys where each step matters | Treats a throwaway visit like a demo |
| Time decay | More to later touches | Longer cycles where recency matters | Under-credits the top of the funnel |
| Position based (40, 20, 40) | Most to first and last | Business sales with clear "created" and "closed" moments | The split is arbitrary |
| Data driven | Modelled marginal contribution | High-volume accounts | A black box; needs volume; blind to offline touches |

Show first-touch and last-touch side by side for long cycles; the gap between them is the insight. A data-driven model collapses toward last click without enough conversion volume; with little volume prefer a simple model plus a sanity check. The platforms' own reports may offer only some models; the full set can still be computed on your own event path or warehouse. Measurement paradigms, by rigour: multi-touch (stitched user-level touches; weakened by cookie and privacy loss; over-weights search and direct), marketing-mix modelling (top-down spend versus outcomes over time; needs long history and real budget swings; correlational), and incrementality (a controlled exposed-versus-withheld test: the gold standard, but only a few at a time). Small budget and short cycle: clean campaign parameters, last non-direct and a self-reported question beat a fancy model. Several channels: multi-touch day to day plus periodic incrementality tests on the biggest lines. Large budgets with brand and offline spend: marketing-mix modelling validated by incrementality.

Self-reported attribution ("How did you first hear about us?", asked at the moment of conversion, with a pick-list of known channels plus free text) catches what tracking cannot (podcasts, word of mouth, private communities). Treat it as a triangulation input and discount it when converting to credit; recall favours the memorable touch.

### Reconciling conflicting sources

| Source | Biased toward | Because |
|---|---|---|
| Ad platforms | Over-counting themselves | Each claims view-through and click conversions in its own window |
| Web analytics | Last non-direct click | Loses cross-device and blocked users, dumps the unknown into direct |
| CRM | What was typed or captured | Human entry, overwritten sources, offline deals |
| Survey | The memorable touch | Recall bias |

Pick one source of truth for the count; never sum across platforms; read directional agreement rather than exact match; use self-reported answers as the tiebreaker and incrementality when stakes justify a test; do not turn a platform gap into a multiplier ("claims twice the analytics number" is not "halve it"); report "platforms claim N, we can verify M, the delta is over-claiming plus view-through plus untracked" and an allocation with confidence levels. Blind spots: direct (a junk drawer that includes real direct visits, stripped referrers, app-to-web, dark social and measurement loss; investigate its composition), branded search (people who discovered you elsewhere and searched your name: segment branded from non-branded or you will defund the top of the funnel), dark social, and AI answers that send people via branded search or direct. Business fork: long-cycle business sales anchor on the CRM with first-touch plus position-based side by side and heavy self-reported use; short-cycle commerce distrusts platform return figures, validates with marketing-mix modelling once spend is material and incrementality on the biggest channels, and adds a post-purchase survey.

### Experiment design

Hypothesis form: "Because [observation], we believe [change] will cause [outcome] for [audience]; we will know when [metric]." A weak one ("the button colour might help") is not a hypothesis.

| Type | Traffic needed |
|---|---|
| A versus B (one change) | Moderate |
| A, B and more | Higher |
| Multivariate | Very high |
| Split URL | Moderate |

Sample size per variant for 95 percent confidence (two-sided) and 80 percent power; lift is relative (3 percent to 3.6 percent is a 20 percent lift):

| Baseline | 10% lift | 20% lift | 50% lift |
|---|---|---|---|
| 1% | 160,000 | 43,000 | 7,700 |
| 3% | 53,000 | 14,000 | 2,500 |
| 5% | 31,000 | 8,200 | 1,500 |
| 10% | 15,000 | 3,800 | 690 |

```js
// node sample-size.mjs 0.05 0.20 : visitors per variant for a 5% baseline and a 20% relative lift
const [p1, lift] = process.argv.slice(2).map(Number);
const p2 = p1 * (1 + lift);
const [zAlpha, zBeta] = [1.959964, 0.841621]; // 95% two-sided, 80% power
const n = Math.ceil(((zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (p2 - p1) ** 2);
console.log(`${n} visitors per variant`);
```

Metrics: one primary tied to the hypothesis; secondary metrics that explain how; guardrails that must not worsen (for a pricing test: plan selection rate primary, time on page and plan mix secondary, support tickets and refunds as guardrails). When a change reaches only visitors who interact with it (a video, a calculator, a chat widget), the overall rate is underpowered: run a triggered analysis (log the same trigger point in both arms and compare those who reached it; never filter on clicks, since the variant can change who clicks), or ship the better version and compare engagement and viewer conversion by version, labelled directional rather than controlled. Allocation: half and half by default; a conservative split when a bad variant is costly; ramp up when the technical risk is high; keep a returning visitor on the same variant. Implementation: client-side is quick but can flicker; server-side decides before render and avoids it. Pre-launch checklist: hypothesis written, primary metric defined, sample size computed, variants built and quality-checked on every variant, tracking verified. During the test: watch for technical issues and segment quality, record external events, stop only for a significantly negative guardrail.

Reading results: a p-value is how incompatible the data are with the null model under its assumptions; it is not the probability that the result is chance or that the variant will win again. A 95 percent interval comes from a procedure with that long-run coverage; report it with the effect size. Sequential and Bayesian analyses have their own interpretation; do not translate a platform's "confidence" score into a fixed-horizon p-value.

| Result | Conclusion |
|---|---|
| Significant winner | Check the effect size, uncertainty and guardrails before shipping |
| Significant loser | Keep the control; learn why |
| No significant difference | Report the interval (it may allow meaningful benefit and harm, or exclude effects worth chasing); follow the stopping rule; plan a new test if needed |
| Mixed signals | Check data quality and the planned metrics; unplanned segments are exploratory |

Document every test: hypothesis, variants with screenshots, results (sample, metrics, interval), decision and learnings.

### Experiment program

Loop: generate hypotheses (analytics drop-offs, research, competitors, support tickets, session evidence, past losers), prioritise with impact, confidence and ease scored 1 to 10 and averaged, run, analyse, add winners to a playbook, repeat. Playbook entry: name, date, hypothesis, sample, result with interval, guardrails, segment differences, why it worked or failed, the reusable pattern, where else to apply it, status. Cadence: weekly check for technical issues and guardrails (no early winners), fortnightly conclusion and next launch, monthly velocity and win-rate review, quarterly playbook audit. A sustained very high win rate may mean the hypotheses are too conservative.

## Implementation

1. Write the tracking plan before any code; get approval for each vendor and the consent behaviour (rule 1).
2. Implement events with the plan's names, fire on confirmed success, and keep personal data out of properties.
3. Verify (rule 9 and the discipline above); record each result with its label (observed, reported, inferred).
4. For reports, compute totals with a script, cross-check them, state the windows, and separate counted conversions from platform-claimed credit.
5. For an experiment, write the hypothesis, compute the sample size, define metrics and guardrails, and fix the stopping rule before launch.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| No account or console access | Give a named check with an expected result and record the answer as reported; mark the platform half unverified |
| Consent denied for most visitors | Report the reduced counts as such; do not recover them by other means |
| Two senders double count | Remove one sender or deduplicate with shared event identifiers; confirm with a test |
| Too little traffic for the planned test | Test a bigger change, lengthen the test, use a higher-baseline metric, or ship on judgement and measure afterwards (labelled directional) |
| The user wants one true number | Offer a defensible, consistent number and a trend read; explain why a single objective truth does not exist |
| A test stopped early on a good-looking result | Treat it as preliminary; rerun or extend only under the original plan |

## Verification

- The tracking plan exists, event names follow it, and no personal data appears in properties.
- Conversions fire on confirmed success; one test conversion was shown arriving, or the unverified part is named.
- Every reported figure was computed from rows, cross-checked, and states its window; cohorts inside their window are labelled pending.
- Findings carry observed, reported or inferred labels; no platform totals were summed.
- Each experiment has a written hypothesis, a computed sample size, a primary metric and guardrails, and its decision and learning recorded.

## Sources

- Adapted and extended from the MIT-licensed `analytics`, `conversion-tracking`, `attribution` and `ab-testing` skills by Corey Haines (the decision-first plan, window-matching and compute-do-not-eyeball rules, the confirmed-success and verification discipline, the observed-reported-inferred labels, the verdict rules, the attribution models and paradigms, reconciliation, and the experiment design and program). Rewritten and condensed for this package: the approval and consent rules, a zero-dependency sample-size script in place of external calculators, and the removal of dated platform notices and vendor tool lists that cannot be re-verified here.
