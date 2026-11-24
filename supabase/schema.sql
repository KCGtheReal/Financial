-- ==============================================================================
-- APEX FINANCE: SUPABASE CLOUD DATABASE SCHEMA
-- Copy and paste this entire script into your Supabase SQL Editor and click "Run"
-- ==============================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  pin_code TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  avatar TEXT DEFAULT 'User',
  avatar_color TEXT DEFAULT '#09090B',
  currency TEXT DEFAULT 'USD',
  is_logged_in BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on email for fast login lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- 2. ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL,
  balance NUMERIC DEFAULT 0,
  initial_balance NUMERIC DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts (user_id);

-- 3. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  date TEXT NOT NULL,
  account_id TEXT REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id TEXT,
  category_id TEXT,
  sub_category_id TEXT,
  merchant TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'cleared',
  tags TEXT[] DEFAULT '{}',
  is_split BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date);

-- 4. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  parent_id TEXT,
  "order" INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Allow read/write for Apex application client (using Supabase anon key)
DROP POLICY IF EXISTS "Public access for users" ON public.users;
CREATE POLICY "Public access for users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for accounts" ON public.accounts;
CREATE POLICY "Public access for accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for transactions" ON public.transactions;
CREATE POLICY "Public access for transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for categories" ON public.categories;
CREATE POLICY "Public access for categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
