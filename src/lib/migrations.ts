/** Copie exacte de supabase/migrations/20261129000000_invoices_deposits.sql (un test vérifie l'égalité) : affichée dans l'application pour être collée dans Supabase. */
export const INVOICES_SQL = `-- Étape f (suite) : acompte sur les devis, factures importées de Shine.
alter table quotes add column if not exists deposit_percent int not null default 0 check (deposit_percent between 0 and 100);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  prospect_id uuid references prospects(id) on delete set null,
  client_name text not null,
  issued_on date,
  paid_on date,
  total_ht_cents int,
  vat_cents int,
  total_cents int not null,
  kind text not null default 'invoice' check (kind in ('invoice', 'deposit', 'credit')),
  source text not null default 'Shine',
  import_batch_id uuid references import_batches(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists invoices_prospect_idx on invoices (prospect_id);

alter table invoices enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'invoices' and policyname = 'members_all') then
    create policy members_all on invoices for all to authenticated using (is_member()) with check (is_member());
  end if;
end $$;
grant select, insert, update, delete on invoices to authenticated;
revoke all on invoices from anon;
`;
