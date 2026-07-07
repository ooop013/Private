-- ============================
-- 매출관리 앱 기본 스키마
-- ============================

-- 1. 매출 테이블
create table sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sale_date date not null,
  amount numeric not null,
  memo text,
  created_at timestamptz default now()
);

-- 2. 지출 테이블
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null,
  amount numeric not null,
  category text,
  memo text,
  created_at timestamptz default now()
);

-- ============================
-- RLS (Row Level Security) 활성화
-- ============================

alter table sales enable row level security;
alter table expenses enable row level security;

-- ============================
-- RLS 정책: 본인 데이터만 조회/수정 가능
-- ============================

-- sales 정책
create policy "sales_select_own" on sales
  for select using (auth.uid() = user_id);

create policy "sales_insert_own" on sales
  for insert with check (auth.uid() = user_id);

create policy "sales_update_own" on sales
  for update using (auth.uid() = user_id);

create policy "sales_delete_own" on sales
  for delete using (auth.uid() = user_id);

-- expenses 정책
create policy "expenses_select_own" on expenses
  for select using (auth.uid() = user_id);

create policy "expenses_insert_own" on expenses
  for insert with check (auth.uid() = user_id);

create policy "expenses_update_own" on expenses
  for update using (auth.uid() = user_id);

create policy "expenses_delete_own" on expenses
  for delete using (auth.uid() = user_id);

-- ============================
-- 가계부 > 계좌관리
-- ============================

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bank', 'card', 'savings', 'stock')),
  nickname text not null,
  institution text,       -- 은행명 / 카드사 / 은행사
  account_number text,     -- 계좌번호 / 카드번호
  cvc text,                -- 카드 전용
  expiry_date date,        -- 카드/적금 만기일
  interest_rate numeric,   -- 적금 적용금리(%)
  deposit_amount numeric,  -- 적금 납입금액
  amount numeric,          -- 주식 평가금액
  memo text,               -- 용도
  created_at timestamptz default now()
);

alter table accounts enable row level security;

create policy "accounts_select_own" on accounts
  for select using (auth.uid() = user_id);

create policy "accounts_insert_own" on accounts
  for insert with check (auth.uid() = user_id);

create policy "accounts_update_own" on accounts
  for update using (auth.uid() = user_id);

create policy "accounts_delete_own" on accounts
  for delete using (auth.uid() = user_id);

-- ============================
-- 가계부 > 예산관리
-- ============================

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  monthly_amount numeric not null default 0,
  created_at timestamptz default now()
);

alter table budgets enable row level security;

create policy "budgets_select_own" on budgets
  for select using (auth.uid() = user_id);

create policy "budgets_insert_own" on budgets
  for insert with check (auth.uid() = user_id);

create policy "budgets_update_own" on budgets
  for update using (auth.uid() = user_id);

create policy "budgets_delete_own" on budgets
  for delete using (auth.uid() = user_id);

-- 지출내역(expenses)에서 계좌(결제수단/이체)와 예산구분을 참조하기 위한 컬럼
alter table expenses add column if not exists account_id uuid references accounts(id) on delete set null;
alter table expenses add column if not exists to_account_id uuid references accounts(id) on delete set null;
alter table expenses add column if not exists budget_id uuid references budgets(id) on delete set null;

-- ============================
-- 견적 시스템 (가격규칙 기반 시술 조립)
-- ============================

-- 1) 가격 규칙 — 최상위, 독립적으로 관리
create table price_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- 규칙별 수량-금액 티어 (예: 대형파츠 2개 = 10,000)
create table price_rule_tiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid not null references price_rules(id) on delete cascade,
  qty integer not null check (qty > 0),
  price numeric not null,
  unique (rule_id, qty)
);

-- 2) 파츠 — 규칙을 참조만 함, 자체 가격 없음
create table parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  image_url text,
  rule_id uuid references price_rules(id) on delete set null,
  created_at timestamptz default now()
);

-- 3) 기본메뉴 / 추가메뉴 — 고정 단가
create table base_menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  created_at timestamptz default now()
);

create table addon_menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  created_at timestamptz default now()
);

-- 최종 할인 옵션
create table discount_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  percent numeric not null default 0,
  created_at timestamptz default now()
);

-- 완성된 견적 (스냅샷 저장 — 이후 규칙/단가가 바뀌어도 과거 견적 금액은 그대로 유지)
create table quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_date date not null,
  base_menu jsonb,             -- {id, name, price}
  addons jsonb default '[]',   -- [{id, name, price}]
  parts jsonb default '[]',    -- [{id, name, qty, price}]
  discount_percent numeric default 0,
  total_amount numeric not null,
  memo text,
  created_at timestamptz default now()
);

alter table price_rules enable row level security;
alter table price_rule_tiers enable row level security;
alter table parts enable row level security;
alter table base_menus enable row level security;
alter table addon_menus enable row level security;
alter table discount_options enable row level security;
alter table quotes enable row level security;

create policy "price_rules_select_own" on price_rules for select using (auth.uid() = user_id);
create policy "price_rules_insert_own" on price_rules for insert with check (auth.uid() = user_id);
create policy "price_rules_update_own" on price_rules for update using (auth.uid() = user_id);
create policy "price_rules_delete_own" on price_rules for delete using (auth.uid() = user_id);

create policy "price_rule_tiers_select_own" on price_rule_tiers for select using (auth.uid() = user_id);
create policy "price_rule_tiers_insert_own" on price_rule_tiers for insert with check (auth.uid() = user_id);
create policy "price_rule_tiers_update_own" on price_rule_tiers for update using (auth.uid() = user_id);
create policy "price_rule_tiers_delete_own" on price_rule_tiers for delete using (auth.uid() = user_id);

create policy "parts_select_own" on parts for select using (auth.uid() = user_id);
create policy "parts_insert_own" on parts for insert with check (auth.uid() = user_id);
create policy "parts_update_own" on parts for update using (auth.uid() = user_id);
create policy "parts_delete_own" on parts for delete using (auth.uid() = user_id);

create policy "base_menus_select_own" on base_menus for select using (auth.uid() = user_id);
create policy "base_menus_insert_own" on base_menus for insert with check (auth.uid() = user_id);
create policy "base_menus_update_own" on base_menus for update using (auth.uid() = user_id);
create policy "base_menus_delete_own" on base_menus for delete using (auth.uid() = user_id);

create policy "addon_menus_select_own" on addon_menus for select using (auth.uid() = user_id);
create policy "addon_menus_insert_own" on addon_menus for insert with check (auth.uid() = user_id);
create policy "addon_menus_update_own" on addon_menus for update using (auth.uid() = user_id);
create policy "addon_menus_delete_own" on addon_menus for delete using (auth.uid() = user_id);

create policy "discount_options_select_own" on discount_options for select using (auth.uid() = user_id);
create policy "discount_options_insert_own" on discount_options for insert with check (auth.uid() = user_id);
create policy "discount_options_update_own" on discount_options for update using (auth.uid() = user_id);
create policy "discount_options_delete_own" on discount_options for delete using (auth.uid() = user_id);

create policy "quotes_select_own" on quotes for select using (auth.uid() = user_id);
create policy "quotes_insert_own" on quotes for insert with check (auth.uid() = user_id);
create policy "quotes_update_own" on quotes for update using (auth.uid() = user_id);
create policy "quotes_delete_own" on quotes for delete using (auth.uid() = user_id);