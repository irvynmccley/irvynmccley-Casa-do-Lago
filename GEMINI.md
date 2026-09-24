# Casa do Lago — Sistema de Gestão e Controle Financeiro da Obra

Este documento serve como memória técnica e guia de contexto para o **Gemini** (e assistentes de IA) compreenderem profundamente a arquitetura, regras de negócio, participantes e funcionamento do projeto **Casa do Lago**.

---

## 1. Visão Geral do Projeto

O **Casa do Lago** é uma aplicação web completa voltada para a gestão financeira, rateio de despesas, controle de aportes, acompanhamento de faturas de cartão de crédito e amortização de parcelas da compra do terreno e construção da obra da Casa do Lago.

- **Objetivo Principal**: Centralizar todos os gastos da obra, automatizar o cálculo de divisão de custos entre os sócios, controlar o fluxo de caixa físico/bancário e manter um histórico auditável com sincronização na nuvem e suporte offline.
- **Público/Usuários**: Os proprietários/sócios da obra e visualizadores autorizados (modo compartilhado).

---

## 2. Pessoas & Papéis (Sócios e Doadores)

- **Sócios Ativos no Rateio (`Person`)**:
  - **Mccley**
  - **Jan**
  - **Saulo**
  - *(Também referenciado em rateios fixos de 4 pessoas: **Jorge**, **Mccley**, **Jan**, **Saulo**)*
- **Doadores (`Donor`)**:
  - Jorge, Jane, Saulo, Mccley, Jan.
  - *Regra*: Gastos marcados como `doação` não geram dívida de rateio entre os sócios.

---

## 3. Regras de Negócio Financeiras

### A. Rateio Mensal de Custos Fixos
- **Custos Fixos Mensais**: **R$ 750,00** por mês.
  - R$ 700,00: Parcela mensal do Terreno (vencimento todo dia 25).
  - R$ 50,00: Taxa de condomínio / monitoramento.
- **Divisão Fixa**: R$ 750,00 ÷ 4 pessoas = **R$ 187,50 por pessoa/mês**.

### B. Ciclo de Fatura de Cartão de Crédito
- **Regra de Fechamento**: Corte no **dia 28**.
  - Compras realizadas entre o dia **1 e o dia 28** entram na fatura do **mês corrente**.
  - Compras realizadas a partir do **dia 29** caem na fatura do **mês seguinte**.
- **Parcelamento**: Despesas no cartão podem ser divididas em $N$ parcelas; o sistema projeta o valor de cada parcela nos meses futuros correspondentes.
- **Rateio da Fatura**: No fechamento mensal, o valor total da fatura de cartão é dividido entre os 4 sócios e somado aos custos fixos de R$ 187,50 para determinar o valor devido por pessoa naquele mês.

### C. Gestão do Terreno (`terreno_installments`)
- **Valor Total Financiado**: **R$ 40.000,00**.
- **Valor da Parcela**: **R$ 700,00 / mês**.
- **Data de Início**: 25 de Fevereiro de 2024 (`2024-02-25`), com vencimento no dia 25 de cada mês até quitação.
- **Saldo Devedor**: `R$ 40.000,00 - Soma das parcelas marcadas como pagas`.
- **Identificador de Parcela**: Formato `YYYY-MM` (ex: `2024-02`, `2024-03`...).

### D. Saldo do Caixa da Obra
- **Entradas no Caixa**: Registros da tabela `incomes` com a flag `isCaixa: true`.
- **Saídas do Caixa**: Despesas com `paymentMethod: 'Caixa'`.
- **Saldo Atual**: `(Total Entradas Caixa) - (Total Despesas Caixa)`.

### E. Rateio de Aportes Gerais (`Incomes` vs `Payments`)
- Entradas gerais da obra (`isCaixa: false`) representam a meta ou custos globais a serem cobertos pelos sócios.
- A divisão base por pessoa é calculada proporcionalmente e comparada com os `payments` efetuados por cada um (`Person`), indicando se o sócio está com saldo devedor ou credor.

---

## 4. Tipos e Estrutura de Dados (`src/types.ts`)

```typescript
export type Category = 
  | 'Combustível' 
  | 'Documentação' 
  | 'Material' 
  | 'Mão de Obra' 
  | 'Monitoramento' 
  | 'Alimentação';

export type PaymentMethod = 'Pix' | 'Cartão' | 'doação' | 'Caixa';
export type Donor = 'Jorge' | 'Jane' | 'Saulo' | 'Mccley' | 'Jan';
export type Person = 'Mccley' | 'Jan' | 'Saulo' | 'Jorge';

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  category: Category;
  local: string;
  value: number;
  paymentMethod: PaymentMethod;
  installments?: number;
  donor?: Donor;
  observation?: string;
  isFixed?: boolean;
}

export interface Income {
  id: string;
  date: string;
  value: number;
  description: string;
  isCaixa?: boolean;
}

export interface Payment {
  id: string;
  date: string;
  value: number;
  person: Person;
}

export interface AppState {
  expenses: Expense[];
  incomes: Income[];
  payments: Payment[];
  terrenoPaidInstallments: string[];
}
```

---

## 5. Arquitetura Tecnológica

- **Frontend**:
  - **Framework**: React 19 com TypeScript.
  - **Bundler**: Vite 6.
  - **Estilização**: Tailwind CSS v4 (`@tailwindcss/vite`) com paleta escura personalizada (`#020817`), estética glassmorphism e microinterações.
  - **Gráficos**: Recharts (gráfico 3D em barras e pizza de despesas por categoria).
  - **Exportações**:
    - `html-to-image` / `html2canvas`: Exportação de cards e faturas em imagem PNG para envio no WhatsApp.
    - `xlsx`: Exportação/Importação completa de planilhas Excel.
  - **Toasts**: Sonner.
  - **Ícones**: Lucide React.
  - **Datas**: `date-fns` com locale `ptBR`.

- **Backend & Banco de Dados**:
  - **PocketBase (Self-Hosted no Coolify)**: Instância ativa em `https://pb-casadolago.janagencia.com.br`, com redução drástica de consumo de memória (~30MB) e persistência SQLite ultrarrápida.
  - **Coleções**: `expenses`, `incomes`, `payments`, `terreno_installments`.
  - **Tempo Real**: Subscrição em tempo real nativa via Server-Sent Events (`pb.collection(name).subscribe('*')`).
  - **Autenticação**: Autenticação com suporte a Superusers e coleções de usuários com timeout defensivo.
  - **Modo Compartilhado**: Acesso via URL com parâmetro `?shared=true` (acesso anônimo restrito para visualização das abas Início, Saídas e Terreno).
  - **Resiliência Offline (`useOfflineSync.ts`)**: Armazena inserções, edições e exclusões em fila no `localStorage` (`offline_sync_queue`) se a rede oscilar ou falhar, sincronizando em lote assim que a conexão retorna.

---

## 6. Telas e Módulos

1. **Login (`src/components/Login.tsx`)**:
   - Acesso seguro de administradores com timeout defensivo contra instabilidades do PocketBase e interface dark moderna.
2. **Dashboard (`src/components/Dashboard.tsx`)**:
   - KPIs de Total da Obra, Saldo do Caixa, Saldo do Terreno e Total de Doações.
   - Gráficos de despesas por categoria.
   - Projeção de faturas futuras de cartão com accordion de itens.
   - Resumo da fatura do mês anterior com cálculo por pessoa (fatura ÷ 4 + R$ 187,50).
   - Exportação instantânea em imagem PNG.
3. **Saídas (`src/components/ExpensesTab.tsx`)**:
   - Registro de despesas com suporte a **Pagamento Dividido (Split)** (ex: metade no Pix e metade no Cartão).
   - Edição, exclusão com modal de confirmação, busca e filtros.
   - Importação e exportação de planilhas Excel.
4. **Entradas & Pagamentos (`src/components/IncomesTab.tsx`)**:
   - Cadastro de aportes e pagamentos dos sócios.
   - Tabela de quitação e saldo individual de cada parceiro.
5. **Terreno (`src/components/TerrenoTab.tsx`)**:
   - Checklist interativo de parcelas (R$ 700/mês desde Fev/2024 até atingir R$ 40k).
   - Indicadores visuais de parcelas pagas e a vencer.
6. **Relatórios (`src/components/ReportsTab.tsx`)**:
   - Abas Geral, A Pagar e Faturas.
   - Filtros por categoria, termo de busca e exportação detalhada.
7. **Configurações & Backup (`src/components/ConfigTab.tsx`)**:
   - Geração de backups em JSON, CSV e planilhas Excel multi-abas enriquecidas com coluna de Código de Auditoria.
   - **Módulo de Logs de Alterações ("logs")**: Sistema completo de trilha de auditoria (`auditLogger`) registrando criações, edições, exclusões e sincronizações com data, hora, usuário, ação e Código de Auditoria. Inclui busca, filtros por entidade/ação e exportação de logs em CSV e JSON.

---

## 7. Estrutura de IDs & Rastreabilidade de Auditoria
- **Saídas**: `#EXP-XXXXXX` (baseado nos 6 primeiros caracteres alfanuméricos do ID original).
- **Entradas**: `#REC-XXXXXX`.
- **Pagamentos**: `#PAG-XXXXXX`.
- **Terreno**: `#TER-YYYYMM` (ex: `#TER-202402`).
- *Preservação de Dados*: O ID original do PocketBase é 100% mantido para todas as mutações e integridade relacional; os códigos de auditoria são determinísticos, facilitam conferência visual, comunicação rápida entre sócios e auditoria contábil.
- *Interatividade*: Clique direto sobre qualquer tag de ID copia o código para a área de transferência com notificação Toast.

---

## 8. Diretrizes para Modificações Futuras
- O código-fonte ativo da aplicação está localizado dentro de **`src/`** (sendo `src/main.tsx` o entrypoint configurado no `index.html`).
- Para documentação técnica exaustiva e histórico completo da engenharia do app, consulte sempre o arquivo [`RELATORIO_TECNICO_DO_PROJETO.md`](./RELATORIO_TECNICO_DO_PROJETO.md).
- Mantenha sempre a normalização de categorias via `normalizeCategory` para prevenir divergências com ou sem acentuação.
- Ao alterar cálculos de rateio ou faturas, respeite a regra de fechamento no dia 28 e a divisão de custos fixos de R$ 750,00 entre 4 participantes.
- Todas as mutações com o PocketBase devem passar ou se integrar ao `useOfflineSync` para garantir que o sistema não perca dados em caso de conexão fraca no canteiro de obras.
- Mantenha as linhas de listas e tabelas compactas e com espaçamento otimizado para navegação touch fluida em smartphones.
