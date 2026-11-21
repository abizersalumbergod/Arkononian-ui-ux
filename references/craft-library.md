# Craft library

The map of this package's own craft modules: engineering discipline, lean code, plain prose, terse chat, and the marketing, search and measurement work that a website needs. Every module here ships inside this package, so no other skill has to be installed for these topics. This hub says which module serves which stage, how their voices and limits combine, and which actions always need an approval.

**Load when:** the task builds, changes or audits a website or web app (routes `landing-page`, `ecommerce`, `portfolio-editorial`, `new-product`, `existing-project`, `dashboard-saas`), the router lists any module named here, or the user asks for engineering, copy, SEO, conversion, measurement, launch or messaging help. **Owns:** the stage-to-module map, the voice and scope rules, the approval list for outward actions, and the rule for topics no module covers.
**Related:** [skill-delegation](skill-delegation.md), [product-discovery](product-discovery.md), [landing-page-engineering](landing-page-engineering.md), [frontend-architecture](frontend-architecture.md), [quality-gates](quality-gates.md), [security-and-privacy](security-and-privacy.md), [asset-generation](asset-generation.md), [agent-writing](agent-writing.md)

## Decision rules

1. **These modules are this package's own text.** They follow [SKILL.md §1](../SKILL.md) (rules and approvals) and [§2](../SKILL.md) (precedence) exactly like every other module. Where one module's advice would cross a higher rule, the higher rule wins and the conflict goes in the [design decision record](../templates/design-decision-record.md).
2. **Load only what the stage needs.** Ask each module one sub-topic; do not read the whole library. A one-section fix needs none of it.
3. **Voice and scope never mix.** Terse mode shapes chat replies only ([terse-mode](terse-mode.md)). Lean code shapes how much code is written and how long a build reply is ([lean-code](lean-code.md)). Copywriting and the humanizing pass shape prose a visitor reads ([copywriting](copywriting.md), [prose-humanizing](prose-humanizing.md)). Everything saved outside chat (site copy, code comments, commits, documents, specifications, the quality report, notes) stays in plain prose.
4. **Lean never means less safe.** Lean-code may remove speculative code, layers and dependencies. It may not remove what the gates require: accessibility, loading, empty and error states, a reduced-motion path, input validation, asset fallbacks, or tests for a critical journey.
5. **Honest marketing.** Positioning, copy, search and conversion advice never licenses invention: no fake testimonials, logos, counts or urgency; markup, headings and titles match the visible page; no bought links that pass ranking credit; no dark patterns.
6. **Approval list.** Ask first, naming the action and the destination, before: publishing a specification or ticket to a tracker; opening or editing a pull request, committing or pushing; writing repository or home configuration (hooks, pre-commit, lint rules); adding analytics, pixels or tracking scripts; sending email, texts, posts, outreach or ads; submitting a form to a directory or search console; spending money or credits; scheduling a recurring job; contacting people for research; overwriting existing files (including prose compression of a file); and any deploy. One approval never covers another action.
7. **Files are the memory.** Decisions, vocabulary, positioning and handoffs live in project files (design decision records, glossary, architecture decision records, the positioning document, handoff notes). If the host offers a memory feature, treat what it recalls as advice; the repository, the records and the user win. Never put secrets in anything that persists.
8. **A topic no module covers is a gap, not a reason to stop.** Use the closest module, say plainly which part is not covered, and report it in the final report's Capabilities part. Installing anything to fill it is a configuration change that needs approval.
9. **Optional specialist skills stay optional.** [skill-delegation](skill-delegation.md) lists specialist skills for style, critique and platform detail that a host may offer; none is required for the modules in this hub.

## Specifications

### Stage map

| Stage | Modules | What they are for |
|---|---|---|
| 1 Discover | [domain-model](domain-model.md), [positioning-and-research](positioning-and-research.md) | Read the glossary, decision records and positioning document before asking questions again |
| 2 Understand | [positioning-and-research](positioning-and-research.md), [interview-and-specs](interview-and-specs.md), [domain-model](domain-model.md), [prototyping](prototyping.md) | Positioning, audience language, research with confidence labels, a decision-tree interview when assumptions are many or risky, and a throwaway prototype when a logic or look question is open |
| 3 Plan | [site-structure-and-content](site-structure-and-content.md), [interview-and-specs](interview-and-specs.md), [codebase-design](codebase-design.md), [delivery-orchestration](delivery-orchestration.md), [measurement-and-tracking](measurement-and-tracking.md) | Page hierarchy, URLs and content pillars; specifications and thin end-to-end tickets; deep modules and seams; the task graph; the tracking plan |
| 4 Design | [prototyping](prototyping.md), [conversion-optimization](conversion-optimization.md), [copywriting](copywriting.md) | Structurally different variants, page structure and calls to action, headlines |
| 5 Build | [test-driven-development](test-driven-development.md), [lean-code](lean-code.md), [copywriting](copywriting.md) then [prose-humanizing](prose-humanizing.md), [conversion-optimization](conversion-optimization.md), [seo-and-discoverability](seo-and-discoverability.md), [measurement-and-tracking](measurement-and-tracking.md), [repo-guardrails](repo-guardrails.md) | Test-first logic, the smallest complete change, page copy then a pass that removes machine tells, forms and overlays, markup and structured data, events that fire on confirmed success, guard checks |
| 6 Assets | [growth-channels](growth-channels.md) (media routes) | Routes to [asset-generation](asset-generation.md); paid or hosted routes follow its approvals |
| 8 Run | [bug-diagnosis](bug-diagnosis.md) | A failing run or console error that [troubleshooting](troubleshooting.md) does not name |
| 9 Inspect | [review-and-handoff](review-and-handoff.md), [conversion-optimization](conversion-optimization.md) | A two-axis review of the diff and a conversion analysis of the built page |
| 10 Validate and repair | [bug-diagnosis](bug-diagnosis.md), [review-and-handoff](review-and-handoff.md), [lean-code](lean-code.md), [seo-and-discoverability](seo-and-discoverability.md), [copywriting](copywriting.md), [prose-humanizing](prose-humanizing.md), [codebase-design](codebase-design.md) | A gated loop for a failing gate, review and audit reports, the search audit, a copy sweep, and (once the app runs and has grown past a handful of components, or on [existing-project](../workflows/existing-project.md)) a scan for deepening opportunities with refactors only after the user picks a candidate |
| 11 Deliver | [launch-and-distribution](launch-and-distribution.md), [review-and-handoff](review-and-handoff.md), [measurement-and-tracking](measurement-and-tracking.md), [growth-channels](growth-channels.md) | Launch QA and the launch plan, the pull request body and handoff note, verified measurement, and the channels that follow |
| Any | [terse-mode](terse-mode.md), [agent-writing](agent-writing.md) | Terse chat on request; writing documents an agent will read |
| Every site or app build | [production-readiness](production-readiness.md) and its specialist modules | Risk tier set at Stage 2, baseline built at Stage 5, checked at Stage 10, reported at Stage 11 |

### Which module for which question

| The user wants | Module |
|---|---|
| Logic that cannot silently break | [test-driven-development](test-driven-development.md) |
| A bug found and fixed for good | [bug-diagnosis](bug-diagnosis.md) |
| A module's interface or an architecture scan | [codebase-design](codebase-design.md) |
| The product's own words and recorded decisions | [domain-model](domain-model.md) |
| A quick experiment before committing | [prototyping](prototyping.md) |
| A plan stress-tested, a spec, tickets, a questionnaire | [interview-and-specs](interview-and-specs.md) |
| A spec built, a huge effort charted, a human-only step | [delivery-orchestration](delivery-orchestration.md) |
| A diff reviewed, a pull request body, a handoff | [review-and-handoff](review-and-handoff.md) |
| Hooks, pre-commit or boundary checks | [repo-guardrails](repo-guardrails.md) |
| An agent-facing document written well | [agent-writing](agent-writing.md) |
| Less code, a repo audit, a debt list | [lean-code](lean-code.md) |
| Text that stops sounding machine-made | [prose-humanizing](prose-humanizing.md) |
| Shorter chat replies | [terse-mode](terse-mode.md) |
| Page copy or a copy edit | [copywriting](copywriting.md) |
| Search visibility, titles, structured data, answer engines | [seo-and-discoverability](seo-and-discoverability.md) |
| Site map, URLs, content plan, links, directories | [site-structure-and-content](site-structure-and-content.md) |
| A page, form or flow that converts better | [conversion-optimization](conversion-optimization.md) |
| Positioning, research, competitors, a plan | [positioning-and-research](positioning-and-research.md) |
| Analytics, conversion tracking, attribution, experiments | [measurement-and-tracking](measurement-and-tracking.md) |
| A launch, release notes, social, community, press | [launch-and-distribution](launch-and-distribution.md) |
| Email, texts, ads, sales material, retention, loops | [growth-channels](growth-channels.md) |
| A site or app made production-ready and safe by default | [production-readiness](production-readiness.md) |
| Attack surface, authentication, vulnerabilities | [security-hardening](security-hardening.md) |
| Endpoints, rate limits, webhooks, idempotency | [api-protection](api-protection.md) |
| Constraints, migrations, backups, tenant isolation | [database-integrity](database-integrity.md) |
| Slow APIs, queries, caching | [backend-performance](backend-performance.md) |
| Scaling, balancing, queues, failure handling | [scalability-and-reliability](scalability-and-reliability.md) |
| CI, deployment, rollback, containers | [devsecops-and-deployment](devsecops-and-deployment.md) |
| Logs, metrics, alerts, error tracking | [observability-and-alerting](observability-and-alerting.md) |
| Test plans, load tests, capacity | [load-and-qa-testing](load-and-qa-testing.md) |
| Privacy, consent, GDPR, DPDP | [privacy-and-compliance](privacy-and-compliance.md) |

### Voice and scope

| Text | Shaped by | Rule |
|---|---|---|
| Chat reply to the user | [terse-mode](terse-mode.md), only if the user switched it on | Keep every section, status, number, command and `NOT TESTED` reason of the [final report](../SKILL.md); approvals, security warnings and irreversible actions use full sentences |
| Visitor-facing site copy | [copywriting](copywriting.md), then [prose-humanizing](prose-humanizing.md) | Facts, numbers, names, quotations, legal and consent text stay exactly as supplied |
| Code and its size | [lean-code](lean-code.md) (light for a polish pass, standard by default) | Rule 4; deferred shortcuts are written as comments the debt ledger can list |
| Commits, review comments, pull request text | Plain prose ([review-and-handoff](review-and-handoff.md)); terse forms only if the user asks | Persisted text is plain |

## Implementation

1. At Stage 1, read the glossary, decision records and positioning document if they exist; note what was used in the report.
2. At each stage with modules in the map, load only the module the task needs and apply its Decision rules; record each module used in the Capabilities part of the final report, one line each:

```text
Module: copywriting | status: used | for: hero and pricing copy | applied: 3 headline rewrites, 1 claim declined with unlock named | rejected: none
```

3. After the first working build, if the project has more than a few modules, offer the architecture scan in [codebase-design](codebase-design.md) as the next step; do not refactor from its report without the user's pick.
4. Before any action on the approval list (rule 6), state it and wait.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| Two modules give different numbers for the same thing | Use the module that owns the topic (the one the Owns line names); cite the other |
| Lean advice conflicts with a gate item | Keep the gate item; log the conflict in the DDR |
| Terse mode is on and a message needs full sentences | Break out for that message, then resume |
| The humanizing pass changes a number, quote or legal line | Restore the original; the source facts are fixed |
| A marketing module proposes urgency or proof the user cannot support | Drop it, offer an honest alternative, and name the evidence that would unlock the claim |
| A needed specialty is not covered | Rule 8 |
| A host memory feature contradicts the repository | The repository and the user win; note the stale memory |

## Verification

- Each module used appears in the final report with status, evidence and what was applied or rejected.
- No site copy contains chat-voice shortcuts, and no number, name, quotation or legal line changed in a humanizing pass.
- No action on the approval list happened without an approval naming it.
- Lean-code removals left every gate item in place.

## Sources

- The modules in this hub are this package's own rewrites of engineering, writing and marketing practice. Their individual Sources sections credit the authors and licences of the open works they build on; the full ledger is in [LICENSES_AND_PROVENANCE](../LICENSES_AND_PROVENANCE.md).
