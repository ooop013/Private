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