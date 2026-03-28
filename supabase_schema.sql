-- Script para criação das tabelas no Supabase

-- Tabela de Despesas (Saídas)
CREATE TABLE public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  local TEXT NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  installments INTEGER,
  donor TEXT,
  observation TEXT,
  "isFixed" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdBy" UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabela de Entradas
CREATE TABLE public.incomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  "isCaixa" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdBy" UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabela de Pagamentos
CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  person TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdBy" UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Permitir acesso total a usuários autenticados)
CREATE POLICY "Permitir acesso total a usuários autenticados em expenses" ON public.expenses FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acesso total a usuários autenticados em incomes" ON public.incomes FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acesso total a usuários autenticados em payments" ON public.payments FOR ALL TO authenticated USING (true);

-- Políticas para usuários anônimos (Modo Compartilhado)
CREATE POLICY "Permitir leitura anônima em expenses" ON public.expenses FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir inserção anônima em expenses" ON public.expenses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Permitir atualização anônima em expenses" ON public.expenses FOR UPDATE TO anon USING (true);
CREATE POLICY "Permitir exclusão anônima em expenses" ON public.expenses FOR DELETE TO anon USING (true);

-- Permitir leitura de entradas e pagamentos para o dashboard no modo compartilhado
CREATE POLICY "Permitir leitura anônima em incomes" ON public.incomes FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir inserção anônima em incomes" ON public.incomes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Permitir atualização anônima em incomes" ON public.incomes FOR UPDATE TO anon USING (true);
CREATE POLICY "Permitir exclusão anônima em incomes" ON public.incomes FOR DELETE TO anon USING (true);

CREATE POLICY "Permitir leitura anônima em payments" ON public.payments FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir inserção anônima em payments" ON public.payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Permitir atualização anônima em payments" ON public.payments FOR UPDATE TO anon USING (true);
CREATE POLICY "Permitir exclusão anônima em payments" ON public.payments FOR DELETE TO anon USING (true);

-- Tabela de parcelas do terreno
CREATE TABLE IF NOT EXISTS public.terreno_installments (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.terreno_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acesso total a usuários autenticados em terreno_installments" ON public.terreno_installments FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acesso total anônimo em terreno_installments" ON public.terreno_installments FOR ALL TO anon USING (true);
