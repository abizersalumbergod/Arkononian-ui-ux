# Site structure and content

What pages a site needs and how they connect (hierarchy, navigation, URLs, internal links), what to publish and how to choose it, when pages can be generated at scale without becoming thin, and how links, directory listings and third-party mentions are earned without breaking search-engine rules.

**Load when:** planning or restructuring a site map, navigation, URLs or internal links; deciding what content to create; considering templated pages at scale; planning backlinks, directory listings or comparison pages; migrating a site or adding a blog to an existing one. **Owns:** page hierarchy, navigation rules, URL design and redirects, internal-linking rules, content pillars and prioritisation, the programmatic-page gate, the link-building ladder and link-spam limits, and directory submission order.
**Related:** [seo-and-discoverability](seo-and-discoverability.md), [positioning-and-research](positioning-and-research.md), [copywriting](copywriting.md), [launch-and-distribution](launch-and-distribution.md), [growth-channels](growth-channels.md), [landing-page-engineering](landing-page-engineering.md), [product-discovery](product-discovery.md), [frontend-architecture](frontend-architecture.md), [security-and-privacy](security-and-privacy.md)

## Decision rules

1. **Plan structure from goals.** Establish what the business does, the audiences, the top three goals of the site (conversion, search traffic, education, support), whether this is new or a restructure, which existing URLs must be preserved, and the platform.
2. **Important pages sit within three clicks of the home page.** Go as flat as the navigation stays clean: flat for small sites and portfolios, about three levels for most product and content sites, deeper only for large catalogues and documentation. A dropdown with twenty or more items needs another level.
3. **Header navigation has four to seven items,** ordered by priority, the logo on the left linking home, the call to action rightmost; a mega menu has three or four columns. The footer groups secondary links (product, resources, company, legal).
4. **Breadcrumbs mirror the URL hierarchy,** every segment a link except the current page.
5. **URLs are readable, lowercase, hyphenated, hierarchical and short,** with one trailing-slash policy enforced by redirect. Avoid dates in post URLs, deep nesting, numeric ids, content in query parameters, and mixed parent patterns.
6. **Never change a URL without a permanent redirect** from every old URL to its new one; load and test the map on a sample before and at the switch ([seo-and-discoverability](seo-and-discoverability.md)).
7. **No orphan pages.** Every page has at least one internal link pointing to it; important pages get the most; anchors are descriptive ("our analytics features", never "click here"); roughly five to ten contextual links per thousand words is a starting guideline, not a quota.
8. **Content is searchable, shareable or both,** in that priority. Searchable content captures existing demand; shareable content creates it.
9. **The information-gain gate.** Before committing to a searchable piece, read the current top results for its query and write one sentence on what yours adds that none of them have: original data, a real product example, a working tool or template, a clearer answer, a stronger opinion. If you cannot write that sentence, do not write the piece.
10. **Own three to five pillars.** Each spawns a cluster; hub first, then spokes, each spoke linking back to the hub and to relevant siblings. Most content lives happily under one blog path with good internal links; dedicated hub URLs are for major topics with layered depth.
11. **Score ideas, then make the top ones.** Customer impact (40 percent: how often the topic came up in research, how many customers face it, how charged the pain, the value of those customers), content-market fit (30: it matches problems you solve and you have unique insight and stories), search potential (20: volume, competition, trend, long-tail), resources (10: expertise and assets on hand). Score 1 to 10 per factor, weight, sum, rank.
12. **Balance the calendar about 60 percent searchable, 30 percent shareable, 10 percent experimental.** A new site may lean searchable; an established brand chasing category leadership may lean shareable.
13. **Create once, distribute twice.** Build distribution hooks into the piece (subheads that stand alone, liftable sections, pull quotes); funnel borrowed and rented attention toward owned assets (the list, the site, the community), because those are the only durable ones.
14. **Programmatic pages must each carry unique value.** Swapped variables in a template are thin content. Quality beats quantity: a hundred good pages beat ten thousand thin ones. Never create pages with no search demand; no doorway pages, no keyword stuffing, no duplicate content. Prefer subfolders to subdomains.
15. **Prefer defensible data.** Order of strength: proprietary, product-derived, user-generated, exclusively licensed, public.
16. **Earn links; never buy ranking credit.** Confirm links are the bottleneck before any outreach: the page indexed and matching intent, then a page-level (not domain-level) comparison of referring domains against the pages that outrank it, with internal links from strong pages added first.
17. **Stay inside the spam policies.** Paid, sponsored or exchanged placements carry `rel="sponsored"` or `rel="nofollow"` and a visible disclosure; user-generated links carry `rel="ugc"`. Never use private networks, paid insertions into old articles, automated link creation, or keyword-rich anchors in distributed guest posts or press releases. Let others choose anchor text; do not plan a link velocity; spread links across the pages that need them.
18. **Draft outreach for the user to approve; never send it unasked.** Approve the list and the copy first, since sending is an external action ([SKILL.md §1](../SKILL.md)). Never promise an SEO lift from a sponsored placement.
19. **Directories are the foundation layer, not the strategy.** Build the destination pages first, then submit, and vary positioning by directory type. Submitting a product to a directory is an external form submission: ask first and list the targets.

## Specifications

### Site types

| Type | Depth | Key sections | URL pattern |
|---|---|---|---|
| Product site | 2 to 3 levels | Home, features, pricing, blog, docs | `/features/name`, `/blog/slug` |
| Content or blog | 2 to 3 | Home, blog, categories, about | `/blog/slug`, `/category/slug` |
| Commerce | 3 to 4 | Home, categories, products, cart | `/category/subcategory/product` |
| Documentation | 3 to 4 | Guides, reference | `/docs/section/page` |
| Hybrid | 3 to 4 | Product, blog, resources, docs | `/product/feature`, `/blog/slug` |
| Small business or portfolio | 1 to 2 | Home, services or work, about, contact | `/services/name`, `/work/slug` |

### URL patterns by page type

| Page | Pattern |
|---|---|
| Feature | `/features/{name}` |
| Pricing | `/pricing` |
| Post | `/blog/{slug}` (category: `/blog/category/{slug}`) |
| Case study | `/customers/{slug}` |
| Documentation | `/docs/{section}/{page}` |
| Landing | `/{slug}` or `/lp/{slug}` |
| Comparison or alternatives | `/compare/{name}`, `/vs/{name}` |
| Integration | `/integrations/{name}` |
| Template | `/templates/{slug}` |

### Site plan deliverables

| Deliverable | Content |
|---|---|
| Hierarchy | A tree with a URL at each node (text tree; a diagram when relationships are complex) |
| URL map | Page, URL, parent, navigation location, priority |
| Navigation spec | Header items in order with the call to action, footer sections, sidebar if any, breadcrumb notes |
| Linking plan | Hubs and spokes, cross-section links, an orphan audit when restructuring, recommended links per key page |

### Content types

| Searchable | Shareable |
|---|---|
| Use-case pages (`[persona] + [use case]`, long-tail); hub and spoke; template libraries (standalone value plus product adoption); glossary and definition pages; comparison and alternatives pages | Thought leadership (name a concept readers feel but have not named); data-driven content (product, public or original data); expert roundups; case studies (challenge, solution, results, learnings); behind-the-scenes content |

Citable one-line statistics pages, glossary pages, free tools and tutorials tend to earn links more readily than long guides or opinion; treat that as a hypothesis to test for the site, since the evidence is from vendor studies. Per-format discipline: a post gets ten title options before drafting and about five edit passes; a flagship guide is the one comprehensive resource with a table of contents and links to spokes; a video scripts the hook first; an interview is designed to be cut into a transcript, clips and a recap; an email carries one idea per send.

### Programmatic playbooks

| Playbook | Pattern | Needs |
|---|---|---|
| Templates | `[type] template` | A design or creative product |
| Curation | `best [category]` | Expertise and honest coverage |
| Conversions | `[X] to [Y]` | A tool or utility |
| Comparisons | `[X] vs [Y]` | Real competitor knowledge |
| Examples | `[type] examples` | A library of examples |
| Locations | `[service] in [place]` | A real local presence |
| Personas | `[product] for [audience]` | A multi-segment audience |
| Integrations | `[A] [B] integration` | Real integrations |
| Glossary | `what is [term]` | Subject expertise |
| Translations | The same content in other languages | Genuine localisation |
| Directory | `[category] tools` | Proprietary data |
| Profiles | `[entity name]` | Proprietary data |

Gate before building at scale: validate the keyword pattern and aggregate demand; confirm the data source and how it refreshes; design a template with a unique introduction, data-driven and conditional sections, related links and a call to action matching intent; set hub-and-spoke linking, no orphans, a sitemap per page type and breadcrumbs; noindex very thin variants; pick a platform that holds the page count, refreshes data, renders server-side and controls indexing per page. Monitor indexation rate, rankings, traffic, engagement and conversion; watch for thin-content signals, ranking drops, manual actions and crawl errors.

### Link-building ladder (highest yield first)

| Tactic | Effort | Notes |
|---|---|---|
| Unlinked-mention reclamation | Low | Sites already writing about you; ask for the link |
| Partner, integration, customer and vendor pages | Low | Partner directories, marketplaces, "powered by", case studies |
| Moved, broken or redirected links | Low | Fix with redirects, then ask for updates |
| Inclusion in "best of" lists | Medium | The lists answer engines cite; ask for an honest evaluation |
| Resource and tools pages, broken-link replacement | Medium | Only with an asset that actually fits |
| Expert contributions, guest articles, podcasts | Medium to high | Editorial sites only, never "write for us" networks |
| Data-led digital PR | High | Highest ceiling ([launch-and-distribution](launch-and-distribution.md)) |
| Directories and launch sites | Low | Foundation only |

Qualify each prospect: relevant to the readers, real (traffic not collapsing, editorial standards, outbound links not mostly unrelated commercial anchors), reachable by a named owner, and worth it. Outreach is short, specific and about their page. When judging a link vendor: decline anyone selling followed links by price or rating; ask for the placements and check that the sites have audiences and named authors; look for "write for us" pages on every topic; be wary of vendors that let you pick exact-match anchors; expect reports to show rankings and traffic, not just link counts. After a manual action: remove or qualify links you control, document what you could not remove, file a reconsideration request. Use a disavow file rarely, only for a manual action or a large body of paid or spammy links you created.

### Directory tiers (when relevant)

Launch-day flagships; startup and software directories; AI-tool directories; agent and protocol registries (official registry first); no-code directories; "best of" lists; integration marketplaces; profile and content platforms; local business directories; forums (participate first); press-release sites; niche vertical directories. Foundation first: a public product, a pricing page (even "free while in beta"), privacy and terms, logo files in several formats, five to eight real screenshots, a short demo video, one H1 with a sequential heading hierarchy, matching structured data. Destination pages first: alternatives pages, use-case pages, a template gallery if it fits, and one honest "best of" post for your own category. Vary positioning by audience: outcome for founders, alternative framing for software seekers, AI-first for AI directories, technical depth for developers, ROI and use case for review sites. Submit only where the product genuinely fits.

## Implementation

1. Gather the context in rule 1; list existing URLs that must survive.
2. Produce the plan deliverables; check hierarchy depth, navigation counts and URL consistency; run the link audit (every page has an inbound link, no broken links, descriptive anchors, breadcrumbs everywhere, related-content links, cross-section links).
3. For content, name the pillars, score and rank the ideas, mark each searchable or shareable with the buyer stage and the evidence behind it, and record the information-gain sentence per piece.
4. For programmatic pages, run the gate; build a small batch; check uniqueness and indexation before scaling.
5. For links and directories, present the target list and drafts to the user; send nothing until they approve it.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| A restructure changes URLs without redirects | Stop; build the redirect map first and test a sample |
| Navigation has too many items | Group under fewer parents; move secondary items to the footer |
| Templated pages differ only by a city or keyword | Add unique data and analysis per page or do not publish them |
| Outreach produces paid-link offers | Decline followed paid links; offer sponsorship with the proper attribute and disclosure |
| A directory rejects the listing as a poor fit | Do not resubmit to a wrong category; choose better-fitting targets |
| No resources for a content calendar | Ship the top three scored pieces and one distribution plan |

## Verification

- Every page appears in the hierarchy and has an inbound link; every old URL has a tested redirect.
- Navigation and URL rules hold (counts, depth, case, hyphens, trailing slash).
- Each piece has an information-gain sentence; programmatic pages each carry unique data.
- No link was bought for ranking credit, and every sponsored or exchanged link has the right attribute and disclosure.
- No outreach was sent and no directory form submitted without approval.

## Sources

- Adapted and extended from the MIT-licensed `site-architecture`, `content-strategy`, `programmatic-seo`, `link-building` and `directory-submissions` skills by Corey Haines (the site-type and URL patterns, the linking rules, the information-gain gate, idea scoring and the calendar split, the programmatic playbooks, the link-building ladder and risk policy, directory order). Rewritten and condensed for this package with the approval rules and gates added; vendor statistics and conversion multipliers in the originals were left out because they cannot be re-verified here.
