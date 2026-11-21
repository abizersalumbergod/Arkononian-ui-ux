# Privacy and compliance

The engineering controls that let a site or app handle personal data lawfully: a data inventory, notices and consent that match what the site does, cookie and tracker control, handling of access, export, correction and deletion requests, retention, a register of third-party processors, children's data, breach readiness, legal pages and the indexing of private areas. It covers India's Digital Personal Data Protection Act (DPDP) and the EU and UK GDPR, with a note on California. It is engineering guidance, not legal advice.

**Load when:** a site collects or stores personal data (forms, accounts, orders, analytics, cookies, email, support, uploads, AI features), a privacy policy, terms, cookie banner, export or deletion feature is needed, the user mentions DPDP, GDPR, CCPA, consent, children or "compliance", or readiness row 13 is being assessed (T1 and above). **Owns:** the data inventory, the consent record, consent and cookie rules, rights-request flows, the retention schedule, the processor register, children's data rules, breach-readiness steps, legal-page rules, private-route exclusion, and the compliance checklist.
**Related:** [production-readiness](production-readiness.md), [security-and-privacy](security-and-privacy.md), [security-hardening](security-hardening.md), [database-integrity](database-integrity.md), [observability-and-alerting](observability-and-alerting.md), [measurement-and-tracking](measurement-and-tracking.md), [seo-and-discoverability](seo-and-discoverability.md), [landing-page-engineering](landing-page-engineering.md), [interaction-design](interaction-design.md), [accessibility](accessibility.md), [growth-channels](growth-channels.md), [domain-model](domain-model.md)

## Decision rules

1. **This is not legal advice.** Work out which regimes apply from facts (where the people are, where the operator is, what data, what for): users in India bring the DPDP Act; users in the EU or UK, or monitoring them, bring the GDPR or UK GDPR; California residents bring CCPA and CPRA above their thresholds. State the facts and the conclusion as an assumption, recommend review by counsel for the policy and consent wording, and check the current text, rules and commencement dates (the DPDP Rules are being phased in) on the day of the work.
2. **Start with a data inventory (§1).** Every personal-data item: what it is, the purpose, where it enters, where it is stored (databases, logs, analytics, email tools, backups, processors), who can see it, how long it is kept, and the legal basis or consent. The inventory drives the notice, the banner, the deletion job and the processor list, and is updated when a feature changes.
3. **Minimise.** Collect only what the feature needs; no "just in case" fields; avoid sensitive categories; pseudonymise where the feature allows; ask for an age check rather than a birth date when that is enough.
4. **Notice before collection, in plain language,** at the point of collection and in the policy: what, why, who receives it, how long, the person's rights, how to withdraw consent, and who to contact or complain to. The notice is generated from the inventory, not boilerplate, so it matches reality; it is versioned and dated.
5. **Consent must be real when consent is the basis:** free, specific, informed and unambiguous, given by a clear affirmative action, granular per purpose, never pre-ticked, not a condition for an unrelated service, and as easy to withdraw as to give. Refusing is as easy and as visible as accepting. Record every grant and withdrawal (§2).
6. **Non-essential cookies and trackers do not load before consent** where consent is required. Block the scripts at the source rather than hiding the banner after they ran; store the choice; ask again after a material change; honour the Global Privacy Control signal where the regime requires ([§5](#5-cookie-and-tracker-control)).
7. **Rights requests have a working flow (§3):** access and export, correction, deletion, withdrawal of consent, objection and grievance. Verify identity before disclosing; authenticate, rate-limit and log the endpoint; deletion reaches every store and processor and is confirmed to the person.
8. **Retention is enforced by code.** Each data class has a period and a purge job; logs and backups are included; backups age out on a schedule, and a deletion ledger is replayed after any restore so deleted people do not return. Legal-hold exceptions are written down.
9. **Maintain a processor register (§1).** Every third party that receives personal data: purpose, data, location, contract or data-processing terms, sub-processors and deletion path. Adding a processor is sending data to a new service: ask first ([SKILL.md §1](../SKILL.md)), then update the register and the notice.
10. **Know where data lives.** Record the region of the database, storage, analytics and email provider. The GDPR needs a transfer mechanism for data leaving the EU or UK (adequacy decision or standard contractual clauses); the DPDP Act permits transfers except to countries the government restricts, so check the current notification.
11. **Children need extra care.** Do not target children unless the product is built for them. Under the DPDP Act a child is anyone under 18: verifiable parental consent, and no tracking, behavioural monitoring or targeted advertising aimed at children. Under the GDPR the digital age of consent is between 13 and 16 depending on the country. An age gate must not collect more data than it needs. Children's data raises the tier to T3.
12. **Security safeguards are a legal duty as well as good practice:** encryption, access control, logging, backups and breach detection ([security-hardening](security-hardening.md)). Keep a breach plan (§6) that names who decides and who notifies, and the legal deadlines (the GDPR requires notifying the supervisory authority within 72 hours where there is a risk to people; the DPDP Act requires informing the Data Protection Board and each affected person, with the form and timing set by the Rules).
13. **Sensitive data raises the bar:** health, finance, biometrics, precise location, government identifiers and data about children. Avoid it if the feature allows; otherwise isolate it, encrypt fields, restrict access, shorten retention and treat the build as T3.
14. **Legal pages are drafted from the inventory,** flagged for counsel review, dated and versioned, linked from the footer and from every collection point, and accessible ([accessibility](accessibility.md)). A privacy policy, terms of service and a cookie policy (or section) are the usual set; include a contact and the grievance route the applicable law requires. Never publish them without the user's approval, and never invent company details.
15. **AI features:** disclose them; do not train on user content without permission; apply retention to prompts and outputs; list the model provider in the processor register.
16. **Private areas are never indexed:** account, admin, checkout, invoices, previews and staging need authentication and `noindex`. `robots.txt` is not security, and a disallowed URL can still be indexed from links. Sitemaps list public canonical URLs only ([seo-and-discoverability](seo-and-discoverability.md)).
17. **Analytics follows consent rules too;** measurement design is in [measurement-and-tracking](measurement-and-tracking.md), and consent comes before the first tag fires.

## Specifications

### 1. Inventory and processor register

| Data item | Purpose | Entry point | Stored in | Seen by | Retention | Basis or consent | Processor |
|---|---|---|---|---|---|---|---|
| Email address | Send the waitlist update | Waitlist form | Postgres `signups`, email tool | Owner, email provider | Until unsubscribe plus 30 days | Consent (purpose: updates) | Email provider |
| Order shipping address | Deliver the order | Checkout | Postgres `orders`, carrier API | Owner, carrier | Order life plus the tax-law period | Contract | Carrier |
| IP address and user agent | Security and abuse control | Every request | Server logs | Owner | 30 days | Legitimate interest or necessity (state it) | Host |
| Page views | Understand usage | Analytics script | Analytics provider | Owner | 14 months | Consent | Analytics provider |
| Chat messages to the AI helper | Answer questions | Chat widget | Provider logs, our database | Owner, model provider | 30 days | Consent | Model provider |

Processor register columns: provider, purpose, data categories, region, contract or data-processing terms link, sub-processors, deletion path, date added, who approved.

### 2. Consent record

Store one append-only row per decision: subject (account id or a random anonymous id), purpose, decision (granted or withdrawn), notice version shown, wording or banner version, mechanism (banner, form checkbox, settings), timestamp, and the region detected if the rules differ. The current state is the latest row per subject and purpose. Keep records for as long as you may need to show consent was given.

### 3. Rights requests

| Request | What to do | Evidence |
|---|---|---|
| Access (copy or summary of the data and its processing) | Verify identity; assemble from the inventory's stores and processors; send a structured file (JSON or CSV) plus an explanation | Request log, what was sent, date |
| Correction or completion | Verify; update the source of truth and downstream copies | Before and after note |
| Erasure | Verify; delete or irreversibly anonymise across database, object storage, search indexes, caches, analytics and processors; record backup expiry date; keep only what law requires, with the reason | Deletion ledger entry, processor confirmations |
| Withdraw consent | Apply at once to the purpose; stop the processing and stop the tags | Consent record |
| Object or restrict (GDPR) | Assess against the legal basis; apply or explain | Decision note |
| Portability (GDPR) | Export data the person provided, in a common machine-readable format | Export log |
| Grievance or complaint | Acknowledge, route to the named contact, answer within the legal period, tell the person how to escalate to the regulator | Ticket and reply |
| Nominate a representative (DPDP) | Record the nominee and the conditions | Record |

Response periods: the GDPR gives one month, extendable by two in complex cases; the DPDP Rules set the period for grievance responses and other duties, so confirm the current figure. Put the periods in the runbook as configuration, not as code constants.

### 4. Regime summary (starting orientation; verify the current text)

| Topic | India: DPDP Act 2023 and Rules | EU and UK: GDPR and UK GDPR | California: CCPA and CPRA |
|---|---|---|---|
| Applies when | Digital personal data processed in India, or outside India to offer goods or services to people in India | Operator or processing in the EU or UK, or offering goods or services to, or monitoring, people there | For-profit businesses above thresholds handling California residents' data |
| Basis | Consent (free, specific, informed, unconditional, unambiguous, affirmative) or listed legitimate uses | Six lawful bases (consent, contract, legal obligation, vital interests, public task, legitimate interests) | Notice at collection, opt-outs |
| Core rights | Access to a summary, correction and erasure, grievance redressal, nominate, withdraw consent | Access, rectification, erasure, restriction, portability, objection, rights on automated decisions | Know, delete, correct, opt out of sale or sharing, limit use of sensitive data |
| Children | Under 18: verifiable parental consent; no tracking, behavioural monitoring or targeted advertising | Digital consent age 13 to 16 by country; special care | Opt-in for sale of data of minors under 16 |
| Breach | Inform the Board and each affected person (form and timing in the Rules) | Authority within 72 hours where there is risk; individuals if high risk | State breach laws and private right of action for some breaches |
| Extra for larger or riskier operators | Significant Data Fiduciaries: officer in India, audits, impact assessments | Records of processing, impact assessments, data protection officer where required | Risk assessments and audits under the CPRA rules |
| Cookies and trackers | Consent for the processing they enable | ePrivacy rules require consent for non-essential cookies | Opt-out signals such as Global Privacy Control |

### 5. Cookie and tracker control

| Category | Examples | Before consent | Control |
|---|---|---|---|
| Strictly necessary | Session cookie, CSRF token, load-balancer cookie, the consent choice itself | Allowed; disclose in the policy | None needed |
| Preferences | Language, theme | Allowed if the user set it, otherwise ask | Settings panel |
| Analytics | Page-view tools, session recording, Web Vitals beacons that identify people | Not loaded where consent is required | Consent gate; or aggregate, cookieless measurement without identifiers |
| Marketing | Ad pixels, retargeting, social embeds that track | Not loaded | Consent gate, separate from analytics |
| Embedded third-party content | Video players, maps, social posts | Replace with a click-to-load placeholder | Load on action, then remember the choice |

Banner rules: equal prominence for accept and reject, a settings route to change the choice at any time, no scroll-as-consent, no pre-ticked categories, choice remembered, the banner itself keyboard and screen-reader usable. If Google or other tools offer a consent-signal mode, send the signal only as the second layer; the scripts still do not load until consent where the law requires it.

### 6. Breach readiness

Detect (alerts in [observability-and-alerting](observability-and-alerting.md)), contain (revoke keys, disable accounts, isolate), assess (what data, how many people, risk of harm), decide who notifies the regulator and the people within the deadline, notify with the facts the law requires, record the incident and the lessons. Keep the contact list and draft notices in the runbook. Rotating credentials and notifying people are actions the user approves and performs or authorises.

### 7. Retention starting points (replace with the legal and business need)

| Data | Starting point |
|---|---|
| Server and access logs | 30 to 90 days |
| Security audit log | 12 months, access restricted |
| Analytics events | 14 months or less |
| Account data | Life of the account plus a 30-day grace period after deletion |
| Orders, invoices, tax records | The statutory period in the operator's country (check; it is often several years) |
| Support correspondence | 12 to 24 months after closure |
| Backups | A fixed rotation (for example 35 days); deletions replayed after a restore |
| Marketing consent records | As long as the consent may need proving |

### 8. Compliance checklist (feeds readiness row 13)

Each row is PASS, FAIL, NOT_TESTED or NOT_APPLICABLE with evidence.

1. Applicable regimes stated with the facts behind them.
2. Data inventory and processor register exist and match the code and the third-party scripts found.
3. Privacy notice shown at collection and a policy page exist, generated from the inventory, versioned.
4. Consent is granular, not pre-ticked, withdrawable, recorded; refusing is as easy as accepting.
5. No non-essential cookie or tracker loads before consent (verified in a clean browser profile with the network panel).
6. Rights flows exist for access or export, correction, deletion and withdrawal, tested end to end with a test account.
7. Deletion reaches database, storage, search, caches, analytics and processors; backup expiry documented; deletion ledger exists.
8. Retention rules and purge jobs exist for every personal-data table and log.
9. Processors have terms on file; regions are recorded; transfer mechanism recorded where required.
10. Children: age handling decided; if children's data exists, verifiable consent and no tracking.
11. Security safeguards in place ([security-hardening](security-hardening.md)); breach plan with named roles and deadlines.
12. Legal pages published only after the user's approval and counsel review was offered.
13. Private routes require authentication and carry `noindex`; sitemap lists public URLs only.
14. Accessibility of the banner, forms and legal pages checked.
15. No personal data in logs, error reports, analytics URLs or screenshots.

## Implementation

**Consent table (Postgres)**

```sql
create table consent_events (
  id bigint generated always as identity primary key,
  subject_id text not null,
  purpose text not null check (purpose in ('analytics', 'marketing', 'updates')),
  decision text not null check (decision in ('granted', 'withdrawn')),
  notice_version text not null,
  mechanism text not null,
  created_at timestamptz not null default now()
);
create index on consent_events (subject_id, purpose, created_at desc);
```

**Gating a tracker behind consent (browser)**

```ts
function loadAnalytics() {
  if (document.getElementById('analytics-script')) return;
  const s = document.createElement('script');
  s.id = 'analytics-script';
  s.src = 'https://analytics.example.test/script.js';          // the real provider is added only after approval and an entry in the register
  s.async = true;
  document.head.appendChild(s);
}
export function onConsentChange(consent: { analytics: boolean }) {
  if (consent.analytics && !navigator.globalPrivacyControl) loadAnalytics();
}
```

The tag is never in the static HTML; it appears only after the stored choice is read.

**Deletion job outline**

1. Verify the request (logged-in re-authentication or an emailed link) and create a ledger row with the subject id and the date.
2. In one transaction delete or anonymise rows in every table that holds the person's data, using the inventory as the checklist.
3. Delete objects in storage, entries in search indexes and cache keys; call each processor's deletion endpoint or open the documented request.
4. Write the date the person's data leaves the backups; after any restore, replay the ledger.
5. Confirm to the person and mark the ledger row complete with the evidence.

**Verifying "nothing before consent" (authorised local or staging host)**

Open the site in a clean browser profile, decline everything, load the key pages with the network panel recording, and confirm no request goes to an analytics or advertising domain and no non-essential cookie is set; then accept analytics and confirm only that category loads. Save the request list as evidence.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| A third-party script sets cookies before consent | Remove it from the static HTML, load it only through the consent gate, or replace it with a click-to-load placeholder |
| The policy says one thing and the site does another | Regenerate the policy from the inventory and fix the code, not the text alone |
| Deletion is requested but backups still hold the data | Document the backup expiry date, replay the deletion ledger after a restore, do not restore into production without it |
| The user wants copied legal text from another site | Do not copy; draft from the inventory and recommend counsel |
| Applicability is unclear | State the assumption, apply the stricter common controls (consent, minimisation, deletion) and ask counsel |
| Analytics needs consent but the owner dislikes banners | Offer aggregate, cookieless measurement without identifiers, disclose it, or accept lower data |
| Age cannot be established | Treat the user as a minor for the risky features or exclude them; do not collect extra data to verify unless the law requires it |
| Processor contract terms are unknown | Mark the row NOT_TESTED, list the provider, and ask the user to obtain the terms |
| No account exists for export and deletion | A documented email-based process with identity checks and a ledger is the minimum |
| Legal pages need company details | Ask the user; never invent registered names, addresses or officer contacts |

## Verification

- The applicable regimes, assumptions and the data inventory exist and match the code and the scripts actually loaded.
- The §8 checklist is complete with evidence per row, and each NOT_TESTED row has a reason.
- A clean-profile network capture shows no non-essential request or cookie before consent, and the capture is saved.
- A test account completed export and deletion end to end, and the deletion ledger shows each store and processor.
- Retention jobs exist and a run was observed, or the row is NOT_TESTED.
- Legal pages are marked as drafts for counsel until the user approves publication.

## Sources

- Paraphrased, no text copied, check the current texts and commencement dates: India's Digital Personal Data Protection Act 2023 and the DPDP Rules made under it; Regulation (EU) 2016/679 (GDPR) articles on lawful basis, consent, rights, processors, security, breach notification and transfers; the ePrivacy Directive article on cookies and similar technologies; the UK GDPR and PECR; CCPA and CPRA with the Global Privacy Control; regulator guidance on cookie banners (EDPB, ICO, CNIL).
- Structure and rules follow phase 10 of the user's production-readiness brief. This module does not replace advice from a qualified lawyer.
