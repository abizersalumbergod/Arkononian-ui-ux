# Database integrity

Keeping stored data correct, owned by the right person, safe under concurrent writes, recoverable and deleted when it should be: constraints and keys, types, transactions and concurrency, tenant isolation, soft delete, migrations that do not hurt, backups that are proven by a restore, retention, and the Supabase and Firebase access rules that vibe-coded apps most often leave open. Query speed and indexes for load are in [backend-performance](backend-performance.md); replicas and failover are in [scalability-and-reliability](scalability-and-reliability.md).

**Load when:** designing or changing a schema, writing migrations, models or SQL, using Postgres, MySQL, SQLite, Supabase, Firebase, MongoDB or a hosted database, handling ownership or multi-tenancy, planning backups and restores, fixing duplicated, lost or inconsistent data, or adding retention and deletion. **Owns:** the schema review checklist, key and type rules, transaction and concurrency patterns, tenant isolation and row-level security, soft-delete rules, migration safety, destructive-change gates, backup and restore drills with RPO and RTO, retention, and the data integrity audit queries.
**Related:** [production-readiness](production-readiness.md), [security-hardening](security-hardening.md), [api-protection](api-protection.md), [backend-performance](backend-performance.md), [scalability-and-reliability](scalability-and-reliability.md), [devsecops-and-deployment](devsecops-and-deployment.md), [privacy-and-compliance](privacy-and-compliance.md), [load-and-qa-testing](load-and-qa-testing.md), [domain-model](domain-model.md), [codebase-design](codebase-design.md), [dashboard-engineering](dashboard-engineering.md), [security-and-privacy](security-and-privacy.md)

## Decision rules

1. **The database enforces the invariants.** Application validation is for friendly errors; the constraints are the truth: `NOT NULL`, `UNIQUE`, foreign keys, `CHECK`, exclusion constraints. A rule that only the code enforces is broken the first time two requests race.
2. **Design keys and constraints in the first migration.** Every table has a primary key, every relationship a foreign key, every natural uniqueness a unique constraint. Choose `ON DELETE` on purpose: restrict by default, cascade only for children that cannot exist alone, set null only for truly optional links.
3. **Use the right types.** Money is integer minor units or `numeric(p,s)`, never floating point. Timestamps are `timestamptz` in UTC. Text columns that hold emails or usernames are normalised (lower-case or `citext`) with a unique index on the normalised value. Enumerated values use a `CHECK` or an enum type.
4. **Every row has an owner.** Rows that belong to a user or tenant carry a non-null owner column with a foreign key. Queries filter by it in the data-access layer, and row-level security repeats the rule in the database as defence in depth.
5. **Transactions wrap invariants, and stay short.** Group the statements that must succeed together, keep external calls, emails and sleeps out of them, lock rows in a consistent order, and retry deadlocks and serialisation failures a bounded number of times.
6. **Use the weakest concurrency tool that is correct:** one atomic statement, a unique constraint, a row lock (`FOR UPDATE`, `SKIP LOCKED` for queues), an optimistic version column, an advisory lock for a rare global section, or `SERIALIZABLE` with retry for complex invariants. Never read a value in one request, compute in the application and write it back later.
7. **Soft delete only when the product needs undo or an audit trail.** Unique constraints become partial (`where deleted_at is null`), reads go through a view or policy that hides deleted rows, a purge job removes them for good, and erasure requests have a real hard-delete path ([privacy-and-compliance](privacy-and-compliance.md)).
8. **Migrations are versioned, reviewed, forward-only and backward-compatible.** They live in the repository, run in CI against an empty database and against a restored copy, never edit after being applied, and follow expand, backfill, switch, contract so the previous app version keeps working during a rolling deploy.
9. **Destructive changes are gated.** Dropping a column or table, narrowing a type, bulk update or delete, and truncation need a verified backup less than a day old (with a tested restore), proof that no running code uses the data (deploy the code change first), row-count assertions, a recovery plan, and the user's approval for production ([production-readiness](production-readiness.md) rules 8 and 10). Never run one against production unasked.
10. **A backup counts only after a restore.** Backups are automatic, encrypted, stored away from the primary (another account or region), and cover object storage too. T2 and above run a restore drill before launch, after major schema changes and on a schedule; an untested backup is NOT_TESTED.
11. **Retention is designed in.** Every table holding personal data has a retention rule and a purge job; audit logs are append-only and stored separately.
12. **Replicas lag.** Reads that must see the user's own write go to the primary; replication lag is monitored; replicas are added for measured read pressure only.
13. **No partitioning or sharding without a measured need** (table size that breaks maintenance windows, retention by dropping partitions). Never shard pre-emptively.
14. **Environments are separate.** Each environment has its own database and credentials; preview deployments never touch production data; seed and fixture data is labelled and cannot ship to production; developer machines do not hold production credentials.
15. **Test constraints, transactions and policies against the real engine** (a container or a local instance), not against mocks.

## Specifications

### 1. Schema review checklist (per table)

| Check | Pass condition |
|---|---|
| Primary key | Present, stable, not user-supplied |
| Foreign keys | One per relationship; the referencing column is indexed; `ON DELETE` chosen deliberately |
| Required fields | `NOT NULL` wherever the domain requires a value; defaults explicit |
| Uniqueness | Natural keys (email, slug, external id, (tenant, name)) have unique constraints; soft-delete tables use partial unique indexes |
| Value rules | `CHECK` for ranges, states, non-negative quantities and money |
| Types | Money, time, ids and enums per rule 3 |
| Ownership | Owner or tenant column, non-null, with a composite foreign key where parent and child must share a tenant |
| Access | Row-level security enabled where a browser-reachable key can query the table, with policies per operation |
| Retention | Retention rule and purge job named for personal data |
| Audit | Who changed what, when, for sensitive tables (an append-only table or trigger) |
| Naming and docs | Table and column comments for non-obvious meaning; terms match the glossary ([domain-model](domain-model.md)) |

### 2. Concurrency patterns

| Scenario | Pattern |
|---|---|
| Decrement stock, balance or quota | `update items set stock = stock - 1 where id = $1 and stock > 0 returning stock;` zero rows means sold out |
| One-time coupon, invite or token | `update coupons set used_at = now() where code = $1 and used_at is null returning id;` |
| Unique username or slug | Unique index; catch the violation and return a friendly error |
| Create-if-missing | `insert ... on conflict (key) do nothing returning ...`, then read |
| Counter or total | Update in the same statement, or derive from rows; avoid read-modify-write |
| Edit of the same record by two people | Version column: `update ... set ..., version = version + 1 where id = $1 and version = $2`; zero rows means conflict |
| Queue of jobs | `select ... for update skip locked limit n` inside a transaction ([scalability-and-reliability](scalability-and-reliability.md)) |
| Money moving between accounts | One transaction, rows locked in id order, check constraint on non-negative balance |
| Cross-request invariant too complex for one statement | `SERIALIZABLE` transaction with bounded retry on serialisation failure |
| Duplicate submissions (double click, retry) | Idempotency key table ([api-protection](api-protection.md) §5) |

### 3. Migration safety (Postgres terms; adapt for other engines)

| Operation | Safe approach | Unsafe approach |
|---|---|---|
| Add a column | `add column ... default <constant>` is a metadata change on modern Postgres; add nullable, backfill in batches, then add the constraint | Adding a volatile default or rewriting a large table in one statement |
| Make a column `NOT NULL` | Add a `CHECK (col is not null) NOT VALID`, `VALIDATE CONSTRAINT`, then `SET NOT NULL` | `SET NOT NULL` on a huge table with no validated check |
| Add a foreign key | `add constraint ... not valid`, then `validate constraint` | Plain `add constraint` on a large, busy table |
| Add an index | `create index concurrently` (outside a transaction block) | Plain `create index` that blocks writes |
| Rename or retype a column | Expand (new column), dual-write, backfill, switch reads, contract later | `alter column type` or `rename` while old code still runs |
| Drop a column or table | Deploy code that no longer reads it, wait a release, take a verified backup, then drop | Dropping in the same release that stops using it |
| Large backfill | Batches of a few thousand rows, resumable, throttled, with progress logging | One `update` over the whole table in a transaction |
| Any lock-taking change | `set lock_timeout = '5s'` so a blocked change fails fast and retries | Waiting indefinitely behind a long transaction |

### 4. Backup and restore drill

Targets are a business decision; starting suggestions:

| Tier | RPO (data you can lose) | RTO (time to be back) |
|---|---|---|
| T1 | 24 hours (daily backup) | 24 hours |
| T2 | 1 hour or less (point-in-time recovery) | 4 hours |
| T3 | Minutes (continuous archiving, replicas) | 1 hour or less |

Drill, run against a scratch target and never against production:

1. Record the start time and which backup (or point in time) is restored.
2. Restore into a new empty instance or database.
3. Run the integrity checks in §7, compare row counts for key tables with the source at backup time, and boot the application against the restore with a read-only smoke test.
4. Record the elapsed time (measured RTO), the age of the newest restored row (measured RPO), what failed, and what the runbook still lacks.
5. Test restoring object storage and configuration separately; note where the encryption keys live.

Record format: `date | backup id or point in time | target | duration | row-count check | smoke test | RPO measured | RTO measured | problems`.

### 5. Tenant isolation and row-level security

Choose the model deliberately: shared tables with a `tenant_id` and row-level security (default for most apps), a schema per tenant (stronger separation, more migration work) or a database per tenant (strongest, highest cost). In every model: the tenant comes from the server session, never from a request field; cache keys, search indexes, storage paths, background-job payloads and exports include the tenant; composite foreign keys `(tenant_id, id)` stop a child pointing at another tenant's parent; and a test tries every resource across tenants.

Row-level security notes (Postgres, Supabase): enabling it with no policy denies everything to non-bypass roles; table owners bypass it unless `FORCE ROW LEVEL SECURITY` is set; superuser and `BYPASSRLS` roles (Supabase's service role) always bypass it, so those keys are server-only; views run with the view owner's rights unless created as security invoker; `security definer` functions bypass policies, so keep them rare and audited; with a transaction-mode pooler, set the tenant with `set_config('app.tenant_id', $1, true)` (transaction-local) inside each transaction instead of a session-level setting.

Firebase and Firestore: replace test-mode rules before launch; no `allow read, write: if true`; rules check `request.auth.uid` against the document owner; test with the emulator.

### 6. Hosted-database specifics (vibe-coding hot spots)

- Supabase: every table in an exposed schema has row-level security enabled and policies written per operation using `auth.uid()` (or a tenant claim); the anon key is public by design and only safe because of those policies; the service-role key never reaches a browser; storage buckets have policies, not "public" by default; run the host's security advisor and treat each lint as a finding.
- Any hosted Postgres: connections through the provider's pooler from serverless functions; separate roles for the app, migrations and read-only reporting; no superuser credentials in the app.
- Connection strings are secrets: names only in reports, per-environment values, rotated on exposure.

### 7. Integrity audit queries (read-only, run on a copy or a replica)

```sql
-- orphan rows (a foreign key that is missing in the schema)
select c.id from child c left join parent p on p.id = c.parent_id where p.id is null;
-- duplicates that a unique constraint should have prevented
select lower(email), count(*) from users group by 1 having count(*) > 1;
-- impossible values
select id from accounts where balance_minor < 0;
select id from orders where total_minor <> (select coalesce(sum(price_minor * qty), 0) from order_items where order_id = orders.id);
-- rows without an owner
select id from documents where owner_id is null;
```

## Implementation

**A table with its constraints (Postgres)**

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  owner_id uuid not null references users(id) on delete restrict,
  status text not null check (status in ('pending', 'paid', 'shipped', 'cancelled')),
  total_minor bigint not null check (total_minor >= 0),
  currency char(3) not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index orders_owner_idx on orders (tenant_id, owner_id, created_at desc);
alter table orders enable row level security;
create policy orders_owner_select on orders for select using (owner_id = auth.uid());
create policy orders_owner_insert on orders for insert with check (owner_id = auth.uid());
```

(`auth.uid()` is Supabase's helper; on plain Postgres use a transaction-local setting such as `current_setting('app.user_id')`.)

**Expand and contract: rename `fullname` to `display_name`**

```sql
-- release 1 (expand): add the new column, write both, backfill in batches
alter table users add column display_name text;
-- release 2 (switch): read display_name, keep writing both
-- release 3 (contract): after a verified backup and a release with no readers of fullname
alter table users drop column fullname;
```

**Restore drill (Postgres, scratch target)**

```bash
pg_dump --format=custom --no-owner "$SOURCE_URL" > scratch.dump          # or use the provider's backup
createdb restore_scratch
pg_restore --no-owner --dbname restore_scratch scratch.dump
psql restore_scratch -f integrity-audit.sql
```

For managed databases use the provider's point-in-time restore into a new instance, then run the same checks. Never point the drill at the production database.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| Duplicate rows exist before adding a unique constraint | Find and resolve them (merge or delete with approval), then add the constraint `not valid` and validate |
| A migration locks the table in production | Cancel it, add `lock_timeout`, use the concurrent or `not valid` forms, retry in a quiet window |
| Row-level security blocks the app's own writes | The app connects as a bypass role by mistake or lacks policies; give it a role subject to policies and add the write policies |
| The service-role key is in browser code | Treat as a leaked secret: user rotates it, move the call to the server ([security-hardening](security-hardening.md) §6) |
| Soft-deleted rows still show up | Move the filter into a view or policy rather than every query |
| Backups exist but no restore was ever run | Run the drill on a scratch target and report the measured RPO and RTO; until then the row is NOT_TESTED |
| Backfill overloads the database | Smaller batches, pauses between them, off-peak window, resume from a stored cursor |
| ORM generates unconstrained tables | Add the constraints as explicit migrations and test them |
| No database engine available for tests | Mark constraint, transaction and policy tests NOT_TESTED; do not substitute mocks and report a pass |
| The user asks for a destructive change without a backup | Stop, explain the gate in rule 9, offer to create and verify the backup first |

## Verification

- Every table passes the §1 checklist or has a recorded reason; unique and foreign-key constraints exist in the migrations, not just in code.
- Concurrency tests ran: parallel requests against stock, coupon, balance and unique-name cases ended with the expected result.
- Cross-tenant and cross-user tests passed for every resource, including search, export, files and caches.
- Migrations ran from empty and against a restored copy in CI; each has a rollback or restore note.
- A restore drill record exists with measured RPO and RTO, or the backup row is NOT_TESTED with the reason.
- No destructive production change ran without a verified backup and the user's approval.
- Integrity audit queries ran with their output recorded.

## Sources

- Paraphrased, no text copied: PostgreSQL documentation (constraints, row-level security, explicit locking, transaction isolation, `CREATE INDEX CONCURRENTLY`, `NOT VALID` constraints), Supabase row-level security and security advisor documentation, Firebase security rules documentation, and the expand and contract migration pattern as used in zero-downtime deployments. RPO and RTO numbers are starting suggestions to be replaced by the business's own targets.
- Structure and rules follow phase 5 of the user's production-readiness brief.
