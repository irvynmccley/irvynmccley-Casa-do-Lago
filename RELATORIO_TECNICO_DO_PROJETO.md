# Relatório Técnico Completo — Casa do Lago
> **Documento de Contexto de Engenharia, Regras de Negócio e Histórico de Desenvolvimento**  
> *Destinado a desenvolvedores e agentes de Inteligência Artificial para aprendizado rápido e preciso do sistema.*

---

## 1. Visão Geral e Propósito do Sistema

O **Casa do Lago** é uma aplicação web full-stack desenvolvida para atender à gestão financeira, rateio de despesas, controle de aportes, auditoria de cartões de crédito e acompanhamento da quitação de terreno na construção de uma residência/obra compartilhada.

### 1.1. O Problema Resolvido
Em obras com múltiplos sócios:
- Compras físicas e online ocorrem em múltiplos meios (Pix, Cartão de Crédito próprio, Caixa em espécie e Doações de parentes).
- Cartões de crédito faturam compras com parcelamento futuro e datas de corte distintas.
- Custos fixos mensais precisam ser rateados com exatidão centavo por centavo.
- No canteiro de obras, a conectividade móvel costuma oscilar, exigindo funcionamento offline sem perda de dados.
- O Casa do Lago centraliza esses fluxos, automatiza os cálculos contábeis, fornece relatórios visuais e projeta despesas futuras com total transparência entre os envolvidos.

### 1.2. Participantes & Papéis
- **Sócios Ativos no Rateio de Custos Fixos e Faturas (`PEOPLE_COUNT = 4`)**:
  - **Mccley**
  - **Jan**
  - **Saulo**
  - **Jorge**
- **Sócios Ativos no Rateio de Aportes Globais (`PEOPLE = 3`)**:
  - **Mccley**, **Jan**, **Saulo** (divisão da meta de investimento em 3 partes iguais).
- **Doadores Registrados (`Donor`)**:
  - **Jorge**, **Jane**, **Saulo**, **Mccley**, **Jan**.
  - *Regra fundamental*: Lançamentos com forma de pagamento `doação` compõem o valor global investido na obra, mas **não geram dívida** nem entram no cálculo de rateio entre os sócios.

---

## 2. Regras de Negócio e Modelagem Matemática

Toda IA que for manipular os cálculos financeiros deve seguir com rigor absoluto as fórmulas descritas a seguir:

### 2.1. Custos Fixos Mensais e Rateio Fixo
- **Custo Fixo Total**: **R$ 750,00 / mês**.
  - **R$ 700,00**: Parcela do financiamento do terreno (vencimento dia 25).
  - **R$ 50,00**: Taxa de condomínio / monitoramento e segurança.
- **Rateio Fixo por Pessoa**:  
  $$\text{Fixo Individual} = \frac{\text{R\$\ } 750,00}{4} = \text{R\$\ } 187,50 \text{ por pessoa/mês}$$

### 2.2. Ciclo de Fatura de Cartão de Crédito (Corte no Dia 28)
- **Data de Fechamento**: **Dia 28** de cada mês.
  - Compras realizadas entre o **dia 01 e o dia 28** entram na fatura do **mês vigente**.
  - Compras realizadas a partir do **dia 29** (dia 29, 30, 31) entram na fatura do **mês seguinte**.
- **Parcelamento ($N$ Parcelas)**:
  - Uma compra de valor $V$ parcelada em $N$ vezes é dividida em $N$ parcelas iguais de $\frac{V}{N}$.
  - A parcela $1$ entra no mês de corte da compra; as parcelas subsequentes $i \in [2, N]$ são projetadas para os meses $(mês + i - 1)$.
- **Fechamento Mensal por Pessoa**:
  $$\text{Total Devido por Pessoa no Mês} = \left(\frac{\text{Total da Fatura do Mês}}{4}\right) + \text{R\$\ } 187,50$$
- O sistema gera automaticamente um card pronto com esse cálculo e botão para exportar em imagem PNG para compartilhamento imediato no WhatsApp dos sócios.

### 2.3. Financiamento do Terreno (`terreno_installments`)
- **Valor Financiado Total**: **R$ 40.000,00**.
- **Valor Padrão da Parcela**: **R$ 700,00 / mês**.
- **Início do Vencimento**: 25 de Fevereiro de 2024 (`2024-02-25`), repetindo-se todo dia 25 até amortização completa (58 parcelas, sendo a última de R$ 100,00 residual).
- **Identificador de Parcela**: Formato `YYYY-MM` (ex: `2024-02`, `2024-03`, ..., `2028-11`).
- **Saldo Devedor Atual**:
  $$\text{Saldo Devedor} = \text{R\$\ } 40.000,00 - \sum \text{Parcelas Pagas}$$

### 2.4. Saldo do Caixa da Obra
- Representa o dinheiro físico ou em conta corrente reservado para despesas operacionais miúdas:
  - **Entradas no Caixa**: Registros de `incomes` marcados com `isCaixa: true`.
  - **Saídas do Caixa**: Registros de `expenses` com `paymentMethod: 'Caixa'`.
  - **Saldo Atual**:
    $$\text{Saldo Caixa} = \sum \text{Incomes}_{\text{isCaixa}} - \sum \text{Expenses}_{\text{Caixa}}$$

### 2.5. Aportes Globais vs. Pagamentos Individuais
- Registros de `incomes` com `isCaixa: false` representam metas ou despesas globais a serem bancadas pelos sócios ativos.
- Cota-parte individual: $\text{Meta} \div 3$.
- Cada sócio realiza aportes registrados em `payments`.
- Se $\text{Aportes Realizados} < \text{Cota-Parte}$, o sócio possui saldo devedor; caso contrário, saldo credor.

### 2.6. Pagamento Dividido (Split Payment)
- Na compra física de insumos caros, é comum pagar parte em Pix ou Dinheiro e parte no Cartão de Crédito.
- O sistema possui suporte nativo a Split Payment na tela de Saídas: divide o lançamento em duas entidades conectadas com sufixos `(Parte 1)` e `(Parte 2)`.

---

## 3. Arquitetura de Software e Tecnologias

### 3.1. Frontend
- **Framework**: React 19 com TypeScript.
- **Build Tool**: Vite 6.
- **Estilização**: Tailwind CSS v4 (`@tailwindcss/vite` e `@theme`) com paleta futurista dark (`#020817`), orbs iluminados com blur, glassmorphism (`backdrop-blur-xl`, `border-slate-800/80`) e classes utilitárias personalizadas.
- **Gráficos**: Recharts (com barras 3D personalizadas via SVG path `TriangleBar` e gráfico de pizza por categoria).
- **Tipografia**: Google Fonts (*Inter* para interface e *JetBrains Mono* para valores numéricos e moedas).
- **Exportação de Mídia**: `html-to-image` e `html2canvas` para renderização de cards e faturas em PNG de alta resolução.
- **Planilhas**: `xlsx` (SheetJS) para importação e exportação de relatórios e backups em `.xlsx` e `.csv`.
- **Feedbacks & Notificações**: Sonner (`Toaster`, `toast.success`, `toast.error`).
- **Ícones**: Lucide React.
- **Datas**: `date-fns` com localização `pt-BR`.

### 3.2. Backend & Banco de Dados (PocketBase no Coolify)
- **Histórico**: Originalmente implementado no Supabase Cloud, o sistema foi **100% migrado para PocketBase self-hosted**, orquestrado pelo **Coolify** em servidor próprio.
- **Instância Ativa**: `https://pb-casadolago.janagencia.com.br`.
- **Benefícios da Migração**:
  - Redução de consumo de memória de ~2GB (Postgres/Supabase stack) para ~30MB (PocketBase SQLite compilado em Go).
  - Custo de infraestrutura reduzido a zero em nuvens de terceiros.
  - APIs RESTful ultrarrápidas com suporte a Server-Sent Events (SSE) nativo para atualizações em tempo real.
- **Coleções do PocketBase**:
  1. `expenses`: Despesas da obra (`date`, `category`, `local`, `value`, `paymentMethod`, `installments`, `donor`, `observation`, `isFixed`, `status`, `receipt_url`, `createdBy`).
  2. `incomes`: Aportes e entradas de caixa (`date`, `value`, `description`, `isCaixa`, `createdBy`).
  3. `payments`: Pagamentos diretos de cada sócio (`date`, `value`, `person`, `createdBy`).
  4. `terreno_installments`: Histórico de parcelas quitadas do terreno (`month_id`, `original_id`).

### 3.3. Resiliência Offline (`src/useOfflineSync.ts`)
- O canteiro de obras frequentemente sofre com sinal de internet fraco ou inexistente.
- A aplicação possui mecanismo defensivo de sincronização offline:
  - Ao executar qualquer mutação (criar, editar, excluir despesa, entrada, pagamento ou marcar parcela do terreno) sem sinal de rede ou com erro de conexão, a operação é salva na fila `offline_sync_queue` no `localStorage`.
  - O estado local da tela é atualizado imediatamente (Optimistic UI) para não travar o usuário.
  - Assim que o navegador emite o evento `window.addEventListener('online')` ou ao abrir a aplicação conectado, a fila é processada em lote no PocketBase e o banco local é sincronizado, emitindo notificação de sucesso com contagem de itens sincronizados.

### 3.4. Modo Compartilhado (`?shared=true`)
- Permite que mestres de obras, prestadores ou familiares visualizem o andamento das despesas e do terreno sem necessidade de login.
- O modo é acionado passando o parâmetro `?shared=true` na URL.
- **Restrição de Acesso**: Bloqueia visualização das abas confidenciais de *Entradas* (aportes individuais dos sócios) e *Configurações* (backups e banco), restringindo a navegação para *Início*, *Saídas* e *Terreno*.

---

## 4. Estrutura do Código-Fonte

```
Casa do lago/
├── .env.example                       # Modelo de variáveis de ambiente
├── Dockerfile                         # Build multi-stage (Node 20 Alpine -> Nginx Alpine)
├── nginx.conf                         # Configuração Nginx com SPA fallback, Gzip e Cache
├── package.json                       # Dependências e scripts de execução
├── tsconfig.json                      # Configuração TypeScript
├── index.html                         # Ponto de entrada HTML com meta-tags SEO e Open Graph
├── GEMINI.md                          # Regras de contexto e memória técnica para LLMs
├── scripts/
│   ├── migrate_casa_do_lago.mjs       # Script de migração Supabase -> PocketBase com auditoria
│   └── deploy_online.mjs              # Automação de lint, build, commit e push
├── src/
│   ├── main.tsx                       # Ponto de inicialização do React com captura de erros
│   ├── App.tsx                        # Componente raiz: estado global, cálculos, rotas e SSE
│   ├── types.ts                       # Declaração das interfaces TypeScript do domínio
│   ├── pocketbaseClient.ts            # Inicialização e configuração do SDK PocketBase
│   ├── useOfflineSync.ts              # Hook com fila de sincronização offline e eventos de rede
│   ├── index.css                      # Configurações do Tailwind CSS v4 e fontes
│   └── components/
│       ├── Login.tsx                  # Tela de autenticação com timeout defensivo
│       ├── Dashboard.tsx              # Painel principal: KPIs, gráficos 3D, faturas e export PNG
│       ├── ExpensesTab.tsx            # Gestão de saídas, filtros, edição, split e Excel
│       ├── IncomesTab.tsx             # Gestão de entradas, aportes e saldos por sócio
│       ├── TerrenoTab.tsx             # Checklist das 58 parcelas do financiamento
│       ├── ReportsTab.tsx             # Relatórios Geral, A Pagar e Faturas de Cartão
│       ├── ConfigTab.tsx              # Exportação de backups em JSON, CSV e Excel multi-abas
│       └── ui/
│           ├── Card.tsx               # Card estilizado com glassmorphism
│           ├── ConfirmDialog.tsx      # Modal de confirmação seguro para exclusões
│           └── NavItem.tsx            # Botão de navegação responsivo (sidebar/bottom-bar)
```

---

## 5. Histórico: O Que Foi Construído Até Agora

### 1. Fundação & Modelagem (Fevereiro/Março 2024 - Inicial)
- Definição do escopo financeiro da obra.
- Criação dos modelos de dados para despesas com discriminação de categoria, local, forma de pagamento, parcelamento e doador.
- Estabelecimento da regra de corte de cartão de crédito no dia 28.

### 2. Interface Moderna e Experiência do Usuário (UI/UX)
- Design dark elegante (`#020817`), eliminando aparência amadora de planilhas.
- Implementação dos KPIs no Dashboard: Total da Obra, Saldo do Caixa, Financiamento do Terreno e Doações.
- Gráfico de barras 3D com profundidade isométrica para categorias de despesas.
- Projeção de faturas futuras com accordion para expandir e inspecionar cada item da fatura.
- Geração de imagem PNG instantânea da fatura mensal para prestação de contas no WhatsApp dos sócios.

### 3. Operação Completa de Saídas e Entradas
- Cadastro de Saídas com validações, filtros e edição in-line.
- **Split Payment**: divisão de compras em dois meios de pagamento no mesmo ato.
- Controle de Entradas: diferenciação estrita entre aportes de caixa (`isCaixa: true`) e aportes gerais.
- Tabela de quitação por sócio: cálculo de débito/crédito individual automático.

### 4. Controle Físico do Terreno
- Checklist interativo de 58 parcelas de R$ 700,00 totalizando R$ 40.000,00 desde 25/02/2024.
- Toggle direto de parcelas pagas com persistência em tempo real e atualização de saldo devedor.

### 5. Relatórios Analíticos e Backups
- Aba de Relatórios dividida em: *Geral*, *A Pagar* e *Faturas de Cartão*.
- Filtro em tempo real por categoria e busca por termo em qualquer campo (local, observação, pagamento).
- Aba de Configurações com gerador de backup em 3 formatos: JSON, CSV e Planilha Excel (`.xlsx`) com abas separadas para Saídas, Entradas, Pagamentos e Terreno.

### 6. Compartilhamento e Identidade Visual (SEO & Branding)
- Parâmetro `?shared=true` para visualização restrita sem necessidade de senha.
- Meta-tags completas Open Graph e Twitter Cards para renderização de cards com imagem ao compartilhar links no WhatsApp e redes sociais.
- Favicon personalizado em formato PNG e ICO.

### 7. Migração Histórica: Supabase -> PocketBase no Coolify
- Substituição da infraestrutura pesada do Supabase por instância leve do **PocketBase** auto-hospedada no Coolify (`https://pb-casadolago.janagencia.com.br`).
- Criação do script de migração automatizada `scripts/migrate_casa_do_lago.mjs`.
- **Auditoria de Batimento Contábil Concluída**:
  - `expenses`: 100% dos registros migrados (diferença financeira: **R$ 0,00**).
  - `incomes`: 100% dos registros migrados (diferença financeira: **R$ 0,00**).
  - `payments` e `terreno_installments`: 100% dos registros íntegros.
- Criação de `Dockerfile` multi-stage e `nginx.conf` de alta performance com compressão Gzip e SPA routing para produção no Coolify.

---

## 6. Guia para Qualquer IA Operar neste Código

Se você for uma IA (Gemini, Claude, GPT, etc.) realizando modificações neste repositório, **siga obrigatoriamente estas regras**:

1. **Normalização de Categorias**:  
   Sempre use a função utilitária `normalizeCategory(cat)` em `src/App.tsx`. Nunca compare categorias diretamente por strings puras sem remover acentos, pois registros legados podem conter `Combustivel` ou `Combustível`.
2. **Respeito ao Fechamento do Cartão (Dia 28)**:  
   Toda lógica que projete ou calcule parcelas de cartão deve considerar o dia 28 como corte: compras até dia 28 pertencem ao mês corrente; compras dia 29 em diante pertencem à fatura do próximo mês.
3. **Respeito aos Custos Fixos (R$ 750,00 ÷ 4)**:  
   O rateio fixo é sempre de R$ 187,50 por pessoa (4 sócios: Jorge, Mccley, Jan, Saulo), mesmo que na tela de Aportes Gerais o rateio seja entre 3 pessoas.
4. **Tratamento de Offline**:  
   Qualquer nova operação de escrita (POST, PATCH, DELETE) deve ser compatibilizada com o `useOfflineSync` ou conter tratamento de fallback para não perder registros no canteiro de obras.
5. **IDs no PocketBase**:  
   O PocketBase exige identificadores alfanuméricos minúsculos de 15 caracteres (ex: `crypto.createHash('sha256').update(id).digest('hex').slice(0, 15)`).
6. **Comandos Úteis**:
   - `npm run dev`: Inicia o servidor Vite local na porta 3000 (`--host=0.0.0.0`).
   - `npm run lint`: Executa verificação de tipagem TypeScript com `tsc --noEmit`.
   - `npm run build`: Compila o bundle de produção otimizado.
   - `npm run deploy`: Executa lint, build, commit e push para o repositório GitHub (que aciona o webhook do Coolify).

---

## 7. Próximos Passos & Oportunidades de Melhoria

- [ ] **Armazenamento de Comprovantes**: Ativar upload de fotos/PDFs de notas fiscais diretamente no Storage de arquivos do PocketBase (`receipt_url`).
- [ ] **Implementação da Aba "Sobre"**: Apresentar resumo técnico da obra, endereço, memorial descritivo e contatos dos fornecedores.
- [ ] **Relatório Executivo em PDF**: Geração de sumário em PDF para impressão ou assinatura formal dos sócios.
- [ ] **PWA Completo**: Configuração de `manifest.json` e Service Worker para permitir instalação nativa do app no Android e iOS.
