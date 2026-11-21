# Launch and distribution

Getting a site or product released and noticed: a readiness gate, a phased launch, the three-pass site-launch QA (before the switch, at the switch, in the first two weeks), and the distribution channels (owned, rented, borrowed) with the rules that keep each honest. Preparing launch material is ordinary work; publishing, posting, emailing or pitching is not, and always needs an approval.

**Load when:** a site goes live, is redesigned, migrated or extended with a big section; a product, feature or release is announced; a launch checklist, release notes or changelog is needed; or social, community, press, referral, partnership, event or creator activity is planned. **Owns:** the readiness gate, the launch phases, the launch QA checklists, the owned-rented-borrowed model, and the rules for each distribution channel.
**Related:** [seo-and-discoverability](seo-and-discoverability.md), [site-structure-and-content](site-structure-and-content.md), [measurement-and-tracking](measurement-and-tracking.md), [conversion-optimization](conversion-optimization.md), [growth-channels](growth-channels.md), [positioning-and-research](positioning-and-research.md), [copywriting](copywriting.md), [security-and-privacy](security-and-privacy.md), [quality-gates](quality-gates.md), [performance](performance.md)

## Decision rules

1. **Publishing is never part of preparing.** Writing a launch plan, a checklist, release notes, posts, press material, emails or outreach is workspace work. Deploying, posting, sending, submitting forms, contacting people or opening listings is an external action: ask first, naming the action, the destination and the exact text, and propose a deploy only after the quality gates in scope have run ([SKILL.md §1](../SKILL.md)). One approval never covers the next action.
2. **Pass the readiness gate before the phases.** Two failure modes: stealth (launching too late, polishing in private) and one-more-feature (never launching). The middle path is simple, lovable and complete: it does one clearly defined thing, a target user would choose it and not merely endure it, and that one thing is a whole experience with no glaring stubs. If you are polishing past that bar, ship; if scope is still growing, cut back to it.
3. **Launch in phases, not as a single day.** Internal (friendly users, one to one, a working demo); alpha (a controlled external group, a landing page with early-access sign-up, a working product in production); beta (work through the early-access list, teasers about the problems solved, a visible beta marker); early access (screenshots and demos, quantitative and qualitative feedback, user research with an engaged group, optionally a product-fit survey, invitations in batches or all at once under an early-access framing); full launch (open sign-up, start charging if not already, announce everywhere). Then keep launching: every feature and update is a smaller launch.
4. **Everything leads back to owned channels.** Owned (email list, site, blog, community you run) compounds and cannot be throttled; rented (social platforms, app stores, marketplaces, video sites) gives speed, not stability, so use one or two where the audience already is and funnel them to owned; borrowed (guest content, partner audiences, speaking, creator partnerships) gives instant credibility only if borrowed attention is converted into owned relationships.
5. **Pick one or two channels per type for the audience,** not all of them. Spreading thin scatters effort and nothing compounds.
6. **Honesty in every channel.** No fake accounts, undisclosed paid or gifted promotion, invented reviews, astroturfing in communities, scraped contact lists, or claims the product cannot support. Sponsored, gifted and affiliate content is disclosed to the audience in the manner the platform and the advertising rules require.
7. **Participate before promoting.** In communities and forums, give value as yourself first; a community built only to extract fails.
8. **A site launch has its own QA.** Run it in three passes (below). The most common launch-day failure is shipping the staging indexing block to production; re-check it at the switch.
9. **Rollback before launch.** Know how to roll back on this platform, and have someone do it once on a preview; lower DNS time-to-live a day ahead if the switch involves DNS.
10. **Redirects deploy with the new site, at the same moment,** and the top pages by traffic are loaded and checked for content, title, canonical and a 200 response.
11. **Measure the launch against the plan:** compare traffic and conversions page by page against the same period before, confirm conversions arrive in each platform, and fix internal links that still point at redirected URLs ([measurement-and-tracking](measurement-and-tracking.md)).
12. **Partner, community, press and creator work follows consent and compliance:** contacts must have a lawful basis, messages follow the rules for the channel and the recipient's location, and personal data is handled as in [security-and-privacy](security-and-privacy.md).

## Specifications

### Site-launch QA

| Pass | Checks |
|---|---|
| Before the switch: content and links | Every planned page exists with final copy (no placeholder text or test prices); a crawl of the staging site finds no broken internal links or missing images; privacy, terms and cookie pages are present and current; contact details, prices and plan names match what sales and support say |
| Before the switch: forms and conversions | Every form submitted with a test entry reaches the inbox or tool it should; confirmation messages and redirects work and spam protection does not block real submissions; conversion tracking fires on confirmed submission, not the click; analytics is installed once per page with internal traffic filtered; the consent banner works and tags respect it |
| Before the switch: SEO | Unique title, description and one H1 on every page; canonicals point to the production host; staging is blocked from indexing and production is not; robots.txt allows what should be indexed and the sitemap lists production URLs; structured data validates; for a migration, the redirect map is loaded and tested on a sample of old URLs |
| Before the switch: performance and access | Core Web Vitals acceptable on the key templates on mobile; works on mobile, in the main browsers and inside in-app browsers; images have alt text, forms have labels, keyboard navigation works; share images and titles render when the URL is shared |
| Before the switch: rollback | A rollback path known and rehearsed; DNS time-to-live lowered if relevant |
| At the switch | Redirects deployed with the site; HTTPS works on every hostname and one redirects to the other; the top ten pages checked; one real form submitted and arriving everywhere; the sitemap submitted (with approval); production indexability re-checked |
| First two weeks | Watch coverage and not-found errors daily for a week, then weekly, and fix missing redirects; compare traffic and conversions page by page; confirm conversions in each platform at the expected rate; fix links pointing at redirects; collect and triage reported bugs |

The performance, accessibility and security items map to the gates in [quality-gates](quality-gates.md); a launch passes only with evidence for each.

### Launch touchpoints (draft all; send only with approval)

Customer email, in-app notice or tour, a site banner linking to the launch material, a "new" marker in navigation, a blog post, release notes, social posts, and listing on launch directories ([site-structure-and-content](site-structure-and-content.md)). Release notes and changelogs: one entry per shipped change, written for the customer's benefit in the customer's words, dated, with no invented impact figures; a weekly "what shipped" digest is a cheap, steady launch habit.

A launch-day listing on a curated product site rewards preparation: a strong tagline, polished visuals and a short demo, supporters and communities engaged beforehand with value first, the team ready for all-day replies, and traffic directed to the owned site to capture sign-ups. After the day, follow up with everyone who engaged and convert the attention into owned relationships.

### Distribution channels

| Channel | What works | Guardrails |
|---|---|---|
| Social | Storytelling first; three to five content pillars (for example industry insight, behind the scenes, educational, personal, promotional at a small share); one flagship piece repurposed rather than fresh posts per platform; platform formats fit the audience | Posts follow [copywriting](copywriting.md) and [prose-humanizing](prose-humanizing.md); scheduling and posting need approval; no fake engagement |
| Community | Built around a shared identity, not only the product; value flows to members first; a flywheel where members help members | Participate as yourself; moderation rules and consent for data; no covert promotion |
| Press and earned media | A real story (data, a strong opinion, a milestone, a sharp before and after), executive time, and a destination page; pitch like to a customer: specific, useful, fast, never about you; the story is the trend or the conflict (a broken system, never a competitor) | Earned media does not drive direct conversions; it builds links, legitimacy and citation surface; pitches and statements need approval; respond to a crisis with a holding statement that is true |
| Referrals and affiliates | Check whether virality can be built into the product first (collaboration and output-sharing products suit it; infrastructure products do not); otherwise a referral or affiliate program with clear value for both sides and honest terms | Disclosure of paid relationships; payout and tax terms are the owner's decision; reviews are asked for, never bought or faked |
| Partnerships | Same buyer, different problem; adjacent in the workflow; similar stage; complementary, not competing | Joint claims are agreed in writing; no misrepresentation of a partner |
| Events | Choose the role (host, sponsor, speak, attend) and one primary outcome; selection beats execution (a handful of events produce most of the value); consider whether in-person is needed at all | Budget and travel are the owner's decisions; badge-scan data needs consent |
| Creators and influencers | Audience alignment beats follower count; a spectrum from paid posts to gifted products to long-term ambassadors; a clear brief; measured by outcomes | Disclosure is mandatory; no undisclosed brand accounts; contracts and payment are the owner's decisions |

## Implementation

1. Run the readiness gate (rule 2); record what is cut or deferred.
2. Choose the phases that fit the project; define each phase's goal, audience and exit signal. A client site often needs only a staging review and the site-launch QA.
3. Prepare the launch material as files; keep a list of every external action with its destination and exact text, and obtain approval item by item.
4. Run the three QA passes with evidence (command output, screenshots, crawl results); mark anything not checked `NOT TESTED` with the reason.
5. At the switch, deploy only with approval and after the gates in scope pass; verify the items "at the switch"; watch the first two weeks and record findings.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| Production ships with the staging block on indexing | Remove it immediately, re-check robots, canonicals and the sitemap, request re-crawling only with approval |
| Traffic drops after a migration | Compare page by page; check the redirect map, canonicals and staging directives first |
| Conversions vanish at launch | Verify the tag, the consent state and the confirmed-success trigger ([measurement-and-tracking](measurement-and-tracking.md)) |
| The launch date keeps slipping | Run the readiness gate; cut scope to one lovable, complete thing |
| A partner or creator wants undisclosed promotion | Decline; disclose, or do not do it |
| A crisis (a breach, a wrong claim) | Publish a true holding statement after approval; state what is known, what is being done and when the next update comes; never speculate |

## Verification

- The launch plan lists every external action with its approval status; none ran without approval.
- Each QA pass has evidence per item; production indexability, canonicals, sitemap and redirects were checked at the switch.
- Conversions were shown arriving, and the first-two-weeks comparison exists page by page.
- No undisclosed paid promotion, fake account or invented proof appears in any channel plan.

## Sources

- Adapted and extended from the MIT-licensed `launch`, `social`, `community-marketing`, `public-relations`, `referrals`, `co-marketing`, `events` and `influencer-marketing` skills by Corey Haines (the owned-rented-borrowed model, the readiness gate and five launch phases, the site-launch QA, the story-angle and earned-media philosophy, the viral-potential spectrum, partner fit, event selection, the influencer spectrum and its disclosure rules). Rewritten and condensed for this package: the approval and honesty rules are new, and the volume-account creator playbook and tool-specific details in the originals were not carried over.
