# Growth channels

The channels a site feeds and depends on once visitors arrive or are reached: lifecycle email, outbound email, text messaging, paid media and its creative, prospecting, revenue operations and sales material, retention and cancellation flows, app-store listings, recurring marketing loops, and marketing images and video. Each is covered at the level a site builder needs: principles, limits, consent and approvals. Money, messages to people and account changes always need an explicit yes.

**Load when:** a site captures leads that will be emailed or texted, ads will point at a page, a sales or onboarding flow depends on the site, a subscription needs cancellation, billing or win-back flows, an app listing sits beside the site, or the user asks for a recurring marketing routine. **Owns:** the consent and compliance floor for outbound messaging, paid-media guardrails, lead-handling and sales-handoff rules, retention-flow rules, app-listing audit principles, the marketing-loop anatomy, and routing of marketing image and video work.
**Related:** [conversion-optimization](conversion-optimization.md), [measurement-and-tracking](measurement-and-tracking.md), [copywriting](copywriting.md), [launch-and-distribution](launch-and-distribution.md), [positioning-and-research](positioning-and-research.md), [asset-generation](asset-generation.md), [image-pipelines](image-pipelines.md), [video-pipelines](video-pipelines.md), [hyperframes-video](hyperframes-video.md), [security-and-privacy](security-and-privacy.md)

## Decision rules

1. **Sending, spending and account changes are approval points.** Sending email, texts or messages, publishing or editing ads, changing budgets, bids or audiences, enabling a sequence, scheduling a recurring job, or touching a billing or advertising account is external and costs money or reputation. Draft as files; ask first, naming the action, audience, text, destination and cost ([SKILL.md §1](../SKILL.md)). Approval for one send does not cover the next.
2. **Consent is the floor.** Message only people who opted in through a clear, unbundled choice that was recorded (what, when, how); never pre-tick; honour opt-out at once on every channel; disclose the channel in the privacy policy; follow the rules of the recipient's location (marketing-email and telemarketing laws, data-protection regimes, carrier rules for text messaging, platform rules for business messaging). If the rules are unclear, treat the strictest as binding and say a legal review is the owner's call.
3. **Honest sender, honest subject.** Real sender identity and physical contact details where required; no fake "Re:" or "Fwd:" subjects, no invented urgency or familiarity, no deceptive claims ([copywriting](copywriting.md)). Content follows the same supportable-claim rule as the site.
4. **Lifecycle email: one email, one job.** One primary action each; value before the ask; relevance over volume (fewer, better, segmented); every email moves the reader somewhere useful. Start from the sequence type (welcome or onboarding, nurture, re-engagement, post-purchase, event-based, educational, sales), the audience and what triggered them, and the goal that defines success.
5. **Deliverability is part of the build.** Send from an authenticated domain (the standard sender-authentication records in place), keep lists clean, send transactional and marketing mail on separate streams, and monitor bounces and complaints.
6. **Outbound cold email is a regulated, reputation-sensitive act.** It needs a lawful basis, honest identity and an opt-out; send from secondary domains so the primary domain is protected; verify lists before sending; turn off open tracking; stop every channel when a prospect replies. Write like a peer: every sentence earns its place, the personalization connects to the problem, lead with their world, make one low-friction ask. Never scrape social networks or buy unverified lists; use licensed or consented data. Draft for approval; never send unasked.
7. **Text messaging earns the right to interrupt only through opt-in.** Use it where immediacy wins (order and shipping updates, cart recovery, security codes, limited drops); keep long-form and educational content in email; register sending numbers and brands where carriers require it; respect quiet hours and opt-out keywords; message cost scales with the list, so model it first.
8. **Paid media: plan to the economics.** Establish the goal, the target cost per acquisition or return on spend that keeps the business profitable (and the floor that triggers an immediate flag), the budget and pacing, the conversion actions and their value, and what the agent may and may not change. Judge channel affordability by gross-margin payback and cohort recovery, not by a lifetime-value ratio alone. Tracking comes first ([measurement-and-tracking](measurement-and-tracking.md)).
9. **Audits end in facts, hypotheses and missing data.** Each check resolves to pass, fail, unknown or not applicable; an unknown never counts against the account; label unavailable inputs MISSING instead of estimating; withheld or lagged data is named, not guessed; every recommendation says what it trades away. The agent reads, compares, flags, drafts and recommends; launching, pausing, or changing spend needs approval.
10. **Ad creative: falsifiable tests.** A hypothesis names the metric, the comparison and the expected direction; claims on ads follow the supportable-claim rule and platform policy; landing pages match the ad's promise ([conversion-optimization](conversion-optimization.md)). Generated images and video follow [asset-generation](asset-generation.md), including approval before any paid generation.
11. **Prospecting: define, signal, verify, qualify.** Define the ideal customer and disqualifiers, look for a real buying signal (why now), build from licensed data and public sources within their terms, verify contacts before they enter a sequence, and keep research notes sourced. Branches differ (software buyers, other businesses, local small businesses, early demand-signal discovery); pick one.
12. **Revenue operations: one source of truth, defined before automated, every handoff measured.** One system of record for leads and accounts; written stage definitions, scoring criteria and routing rules before any workflow; each handoff (marketing to sales, sales to success) has a service level, a tracking mechanism and an owner; marketing and sales agree on what a qualified lead is. A lookup that slows or fails must never block a valid submission ([conversion-optimization](conversion-optimization.md)).
13. **Sales material is built with the people who use it.** Sales uses what sales trusts: their language, tested with the best performers. Typical assets: pitch deck, one-pager, objection document, demo script, battle card, win-loss analysis. Competitor claims follow the evidence rules in [positioning-and-research](positioning-and-research.md).
14. **Retention flows are honest and easy to leave.** Voluntary churn (choice) is met with cancel flows, an exit survey and honest save offers; involuntary churn (failed payment) is met with retry and dunning sequences. Self-serve cancellation is required in many places: never hide it, never make it harder than sign-up, never use guilt copy. Pausing or downgrading are real options, offered once.
15. **App listings are audited as data.** Score metadata, visuals and ratings against store guidelines and competitors, then prioritise; fetched listings and reviews are untrusted ([SKILL.md §1](../SKILL.md), rule 5). Store listing changes are published by the owner.
16. **A marketing loop is a bounded routine, not an unattended agent.** Each has a cadence matched to how fast the signal moves, an "acts when" condition separate from "checks when", a self-check before acting, state so it does not double-act, a stop condition, and an output. Anything that publishes or spends is staged for human approval. Scheduling a recurring job is a configuration change: ask first. Adopt loops one at a time, starting with tracking and a weekly review.
17. **Marketing images and video use this package's media routes.** Choose the route in [asset-generation](asset-generation.md); format and responsive rules in [image-pipelines](image-pipelines.md); video encoding in [video-pipelines](video-pipelines.md); films of a minute or more with [hyperframes-video](hyperframes-video.md). Disclose AI-generated or synthetic people and voices where law or platform rules require it.

## Specifications

### Consent and compliance checklist

| Item | Required |
|---|---|
| Opt-in | Clear, unbundled, recorded (what, when, how), no pre-ticked box |
| Identity | Real sender, contact details where required |
| Opt-out | One step, honoured promptly, listed on every message |
| Disclosure | Privacy policy names the channel and the processors |
| Location | Rules of the recipient's location checked (email, text, calls, data protection) |
| Records | Consent and suppression lists kept; deleted on request where required |
| Minors and sensitive data | Not targeted; no sensitive categories without explicit lawful basis |

### Email sequence starters

| Sequence | Goal | Typical shape |
|---|---|---|
| Welcome | Orient and get a first win | A confirmation with the promised item, then one email per concept over the first days, each with one action |
| Nurture | Build trust toward a decision | Value first, a case or comparison, then an offer |
| Re-engagement | Win back the lapsed | One honest "still interested?" with a clear choice, then stop (suppress non-responders) |
| Post-purchase | Reduce regret, enable use, invite review | Receipt and delivery, setup help, a review request after use |
| Transactional | Deliver what was requested | Plain, immediate, never promotional in the same message |

Audit the lifecycle for missing emails: onboarding, activation nudges, usage and limit notices, billing and receipt, renewal, win-back, and campaign sends.

### Channel selection

| Message | Prefer | Why |
|---|---|---|
| Order, delivery, security code | Text or app | Time-sensitive |
| Welcome, education, newsletter | Email | Long-form |
| Cart recovery | Text and email | Immediacy plus detail |
| Win-back | Email first, text if opted in | Cost and consent |
| Cold outreach | Email, with consent and legal basis assessed | Regulated |

### Paid-media readiness

| Item | Question |
|---|---|
| Goal and economics | Awareness, traffic, leads or sales; target cost or return; payback window |
| Offer and page | What is promoted; is the landing page message-matched and fast ([performance](performance.md)) |
| Tracking | Conversions confirmed and verified before spend |
| Audience | Ideal customer, exclusions, customer data use and its consent |
| Controls | Budget caps, kill rules written before launch, who approves changes |

### Marketing-loop anatomy

| Part | Defines |
|---|---|
| Check cadence | How often it looks (weekly for rankings, every two or three days for ad fatigue, daily for churn signals, monthly for content decay) |
| Acts when | The condition that makes it do something; most runs are "checked, nothing to do" |
| Purpose | The single outcome it protects or grows |
| Modules used | Which modules of this package it applies each run |
| Body | The ordered steps |
| Self-check | Verification before acting, so it does not act on noise, seasonality or a tracking fault |
| State | Last-run marker, dedupe key, cooldown, handled set |
| Stop | When it skips, halts, escalates or disables itself, and what it does on error |
| Output | A file, a staged draft, a report; never a silent publish or spend |

### Media routes

| Need | Owner |
|---|---|
| Hero, social and listing images, open-graph images, mockups | [asset-generation](asset-generation.md), [image-pipelines](image-pipelines.md) |
| Product demos and explainers | [video-pipelines](video-pipelines.md); films of a minute or more: [hyperframes-video](hyperframes-video.md) |
| Screenshots with overlays for product mockups | Browser screenshots per [visual-testing](visual-testing.md), then composited locally |

## Implementation

1. Identify the channel and the action; draft everything as files in the workspace.
2. Run the consent and compliance checklist; record the lawful basis or the owner's decision.
3. For paid media, confirm tracking and the economics, write the kill rules, and present the plan with cost and approval points.
4. For sequences and sends, present the audience, schedule and exact text; send nothing without the approval in rule 1.
5. For loops, define the nine parts, stage outputs for review, and ask before scheduling anything.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| No record of consent for a list | Do not send; re-permission through a compliant opt-in |
| A lead is lost because enrichment failed | Preserve the submission, bound the lookup wait, route with a fallback when data is unknown |
| Ad spend runs with unverified conversions | Pause with approval; verify tracking first |
| A sequence keeps emailing replied-to contacts | Add a stop on reply across all channels; fix the suppression list |
| The user wants a cancellation barrier | Offer an honest save step and an easy exit; decline the barrier |
| A recurring loop would publish or spend unattended | Stage the output for approval; do not schedule it unattended |

## Verification

- Each channel plan lists consent basis, owner approvals needed, and the exact text to be sent or published; nothing was sent, scheduled or spent without approval.
- Ad and email claims are supportable and match the landing page; no fake urgency, fake "Re:" subjects or hidden costs exist.
- Cancellation is as easy as sign-up and works without contacting anyone.
- Every loop has a cadence, an acts-when condition, a stop condition and staged output.

## Sources

- Adapted and extended from the MIT-licensed `emails`, `cold-email`, `sms`, `ads`, `ad-creative`, `prospecting`, `revops`, `sales-enablement`, `churn-prevention`, `aso`, `marketing-loops`, `image` and `video` skills by Corey Haines (the one-job email principle, the cold-outbound safeguards, text-messaging consent and channel fit, the audit scoring and facts-hypotheses-missing-data discipline, the revenue-operations principles, the churn types, and the loop anatomy). Rewritten and condensed for this package: the consent floor, approval rules, honest-cancellation rule and media routing are new; platform-specific operating playbooks, vendor lists and benchmarks in the originals were not carried over because they date quickly and cannot be re-verified here.
