/**
 * Módulo de Gestão de Configurações Financeiras, Custos Fixos e Histórico de Reajustes
 * Projeto Casa do Lago - Sistema de Gestão Financeira
 */

import { auditLogger } from './auditLogger';
import { pb } from '../pocketbaseClient';
import { format } from 'date-fns';
import { Person } from '../types';

export interface CondominioAdjustment {
  effectiveFrom: string; // Formato 'YYYY-MM' (ex: '2024-02', '2026-10')
  condominioCost: number; // Valor da taxa mensal a partir deste mês
  createdAt?: string;    // Data/hora ISO da alteração
  createdBy?: string;    // Usuário que realizou o reajuste
  notes?: string;        // Observação ou motivo do reajuste
}

export interface PartnerFixedInstallment {
  enabled: boolean;
  value: number;
  description?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface FinancialSettings {
  condominioCost: number; // Taxa mensal do mês vigente
  terrenoCost: number;    // Parcela mensal do terreno (R$ 700,00)
  peopleCount: number;    // Número de sócios no rateio (padrão: 4)
  history: CondominioAdjustment[]; // Histórico cronológico de vigências
  partnerFixedInstallments?: Record<Person, PartnerFixedInstallment>; // Parcelas fixas individuais por sócio
}

export const BASELINE_CONDOMINIO_DATE = '2024-02'; // Início do financiamento da Casa do Lago

export const DEFAULT_PARTNER_FIXED_INSTALLMENTS: Record<Person, PartnerFixedInstallment> = {
  Jorge: { enabled: false, value: 0, description: '' },
  Mccley: { enabled: false, value: 0, description: '' },
  Jan: { enabled: false, value: 0, description: '' },
  Saulo: { enabled: false, value: 0, description: '' },
};

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  condominioCost: 50.00,
  terrenoCost: 700.00,
  peopleCount: 4, // Jorge, Mccley, Jan, Saulo
  history: [
    {
      effectiveFrom: BASELINE_CONDOMINIO_DATE,
      condominioCost: 50.00,
      notes: 'Valor inicial estabelecido no início da obra'
    }
  ],
  partnerFixedInstallments: { ...DEFAULT_PARTNER_FIXED_INSTALLMENTS }
};

export const FINANCIAL_SETTINGS_STORAGE_KEY = 'casadolago_financial_settings';
export const PB_SETTINGS_RECORD_KEY = 'cfg_financial_settings';

/**
 * Sanitiza e normaliza um objeto de configurações financeiras
 */
export function sanitizeFinancialSettings(parsed: any): FinancialSettings {
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_FINANCIAL_SETTINGS };
  }

  const terrenoCost = typeof parsed.terrenoCost === 'number' && !isNaN(parsed.terrenoCost) && parsed.terrenoCost > 0
    ? parsed.terrenoCost
    : DEFAULT_FINANCIAL_SETTINGS.terrenoCost;

  const peopleCount = typeof parsed.peopleCount === 'number' && !isNaN(parsed.peopleCount) && parsed.peopleCount > 0
    ? parsed.peopleCount
    : DEFAULT_FINANCIAL_SETTINGS.peopleCount;

  // Normalização do histórico de ajustes
  let history: CondominioAdjustment[] = [];
  if (Array.isArray(parsed.history) && parsed.history.length > 0) {
    history = parsed.history
      .filter((h: any) => h && typeof h.effectiveFrom === 'string' && typeof h.condominioCost === 'number' && !isNaN(h.condominioCost) && h.condominioCost >= 0)
      .map((h: any) => ({
        effectiveFrom: String(h.effectiveFrom).trim(),
        condominioCost: Number(h.condominioCost),
        createdAt: h.createdAt || undefined,
        createdBy: h.createdBy || undefined,
        notes: h.notes || undefined
      }));
  }

  // Se não houver histórico, cria o baseline
  if (history.length === 0) {
    const baseVal = typeof parsed.condominioCost === 'number' && !isNaN(parsed.condominioCost) && parsed.condominioCost >= 0
      ? parsed.condominioCost
      : DEFAULT_FINANCIAL_SETTINGS.condominioCost;
    history.push({
      effectiveFrom: BASELINE_CONDOMINIO_DATE,
      condominioCost: baseVal,
      notes: 'Valor inicial de referência'
    });
  }

  // Ordena histórico por effectiveFrom ascendente
  history.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  // O valor atual do condomínio corresponde ao mais recente ou ao valor explícito
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  const activeCost = getCondominioCostForMonth(currentMonthKey, { condominioCost: 50, terrenoCost, peopleCount, history });

  // Normalização das parcelas fixas por sócio
  const partnerFixedInstallments: Record<Person, PartnerFixedInstallment> = {
    Jorge: { enabled: false, value: 0, description: '' },
    Mccley: { enabled: false, value: 0, description: '' },
    Jan: { enabled: false, value: 0, description: '' },
    Saulo: { enabled: false, value: 0, description: '' },
  };

  if (parsed && typeof parsed.partnerFixedInstallments === 'object' && parsed.partnerFixedInstallments !== null) {
    const raw = parsed.partnerFixedInstallments;
    (['Jorge', 'Mccley', 'Jan', 'Saulo'] as Person[]).forEach(person => {
      if (raw[person] && typeof raw[person] === 'object') {
        const item = raw[person];
        partnerFixedInstallments[person] = {
          enabled: Boolean(item.enabled),
          value: typeof item.value === 'number' && !isNaN(item.value) && item.value >= 0 ? Number(item.value) : 0,
          description: typeof item.description === 'string' ? item.description : '',
          updatedAt: item.updatedAt || undefined,
          updatedBy: item.updatedBy || undefined
        };
      }
    });
  }

  return {
    condominioCost: activeCost,
    terrenoCost,
    peopleCount,
    history,
    partnerFixedInstallments
  };
}

/**
 * Obtém as configurações financeiras do localStorage com fallback para valores padrão
 */
export function getStoredFinancialSettings(): FinancialSettings {
  try {
    const raw = localStorage.getItem(FINANCIAL_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FINANCIAL_SETTINGS };
    const parsed = JSON.parse(raw);
    return sanitizeFinancialSettings(parsed);
  } catch (err) {
    console.warn('[FinancialSettings] Erro ao carregar configurações do localStorage:', err);
    return { ...DEFAULT_FINANCIAL_SETTINGS };
  }
}

/**
 * Retorna o valor do condomínio vigente para um mês específico ('YYYY-MM').
 * Regra de negócio estrita:
 * - Meses anteriores a um reajuste mantêm exatamente o valor da época.
 * - Meses a partir da competência do reajuste utilizam o novo valor.
 */
export function getCondominioCostForMonth(monthKey: string, settings?: FinancialSettings): number {
  const currentSettings = settings || getStoredFinancialSettings();
  const history = currentSettings.history || [];

  if (history.length === 0) {
    return currentSettings.condominioCost ?? DEFAULT_FINANCIAL_SETTINGS.condominioCost;
  }

  // Ordena por competência de início
  const sorted = [...history].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  // Filtra todas as vigências que começaram até o mês solicitado
  const applicable = sorted.filter(h => h.effectiveFrom <= monthKey);

  if (applicable.length > 0) {
    // Retorna a regra mais recente aplicável àquele mês
    return applicable[applicable.length - 1].condominioCost;
  }

  // Se o mês for anterior à primeira vigência registrada, usa o valor da primeira vigência
  return sorted[0].condominioCost;
}

/**
 * Calcula o custo fixo total mensal (Terreno + Condomínio) para um mês específico
 */
export function calculateFixedCostsForMonth(monthKey: string, settings?: FinancialSettings): number {
  const s = settings || getStoredFinancialSettings();
  const condo = getCondominioCostForMonth(monthKey, s);
  return s.terrenoCost + condo;
}

/**
 * Calcula o valor fixo por pessoa para um mês específico (Custo Fixo do Mês ÷ Número de Sócios)
 */
export function calculateFixedPerPersonForMonth(monthKey: string, settings?: FinancialSettings): number {
  const s = settings || getStoredFinancialSettings();
  const total = calculateFixedCostsForMonth(monthKey, s);
  const count = s.peopleCount > 0 ? s.peopleCount : 4;
  return total / count;
}

/**
 * Calcula o custo fixo total mensal padrão (baseado no mês vigente)
 */
export function calculateFixedCosts(settings: FinancialSettings): number {
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  return calculateFixedCostsForMonth(currentMonthKey, settings);
}

/**
 * Calcula o valor fixo por pessoa padrão (baseado no mês vigente)
 */
export function calculateFixedPerPerson(settings: FinancialSettings): number {
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  return calculateFixedPerPersonForMonth(currentMonthKey, settings);
}

/**
 * Salva as configurações financeiras no PocketBase (na nuvem)
 */
export async function saveFinancialSettingsToPocketBase(settings: FinancialSettings): Promise<boolean> {
  try {
    const payload = JSON.stringify(settings);
    const existing = await pb.collection('terreno_installments')
      .getFirstListItem(`month_id = "${PB_SETTINGS_RECORD_KEY}" || original_id = "${PB_SETTINGS_RECORD_KEY}"`)
      .catch(() => null);

    if (existing) {
      await pb.collection('terreno_installments').update(existing.id, {
        notes: payload,
        paid_at: new Date().toISOString()
      });
    } else {
      await pb.collection('terreno_installments').create({
        month_id: PB_SETTINGS_RECORD_KEY,
        original_id: PB_SETTINGS_RECORD_KEY,
        notes: payload,
        paid_at: new Date().toISOString()
      });
    }
    return true;
  } catch (err) {
    console.warn('[FinancialSettings] Erro ao sincronizar com PocketBase:', err);
    return false;
  }
}

/**
 * Carrega as configurações financeiras do PocketBase (nuvem)
 */
export async function loadFinancialSettingsFromPocketBase(): Promise<FinancialSettings | null> {
  try {
    const record = await pb.collection('terreno_installments')
      .getFirstListItem(`month_id = "${PB_SETTINGS_RECORD_KEY}" || original_id = "${PB_SETTINGS_RECORD_KEY}"`)
      .catch(() => null);

    if (!record || !record.notes) return null;
    const parsed = JSON.parse(record.notes);
    return sanitizeFinancialSettings(parsed);
  } catch (err) {
    console.warn('[FinancialSettings] Erro ao carregar do PocketBase:', err);
    return null;
  }
}

/**
 * Aplica um novo reajuste de condomínio respeitando estritamente a regra:
 * - Aplica SOMENTE ao mês selecionado (vigente) e aos meses futuros.
 * - Meses anteriores mantêm o valor da época.
 * - Sincroniza tanto localmente no cache quanto na nuvem no PocketBase.
 */
export async function applyCondominioAdjustment(
  newCost: number,
  effectiveFromMonth: string, // 'YYYY-MM'
  userName: string = 'Administrador',
  notes?: string
): Promise<FinancialSettings> {
  const current = getStoredFinancialSettings();
  const currentHistory = [...(current.history || [])];

  const nowIso = new Date().toISOString();
  const existingIndex = currentHistory.findIndex(h => h.effectiveFrom === effectiveFromMonth);

  const prevCostForEffectiveMonth = getCondominioCostForMonth(effectiveFromMonth, current);

  if (existingIndex >= 0) {
    // Atualiza a regra já existente para esse mesmo mês
    currentHistory[existingIndex] = {
      ...currentHistory[existingIndex],
      condominioCost: newCost,
      createdAt: nowIso,
      createdBy: userName,
      notes: notes || currentHistory[existingIndex].notes || `Reajustado em ${format(new Date(), 'dd/MM/yyyy')}`
    };
  } else {
    // Insere nova vigência
    currentHistory.push({
      effectiveFrom: effectiveFromMonth,
      condominioCost: newCost,
      createdAt: nowIso,
      createdBy: userName,
      notes: notes || `Reajuste a partir de ${effectiveFromMonth}`
    });
  }

  // Ordena cronologicamente
  currentHistory.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  const updated: FinancialSettings = {
    ...current,
    history: currentHistory,
    condominioCost: newCost
  };

  // 1. Salva no localStorage (instantâneo)
  try {
    localStorage.setItem(FINANCIAL_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Erro ao salvar no localStorage:', e);
  }

  // 2. Registra na trilha de auditoria
  try {
    const oldTotal = current.terrenoCost + prevCostForEffectiveMonth;
    const newTotal = updated.terrenoCost + newCost;
    const oldPerPerson = oldTotal / current.peopleCount;
    const newPerPerson = newTotal / updated.peopleCount;

    auditLogger.log({
      action: 'UPDATE',
      actionLabel: 'Reajuste de Condomínio',
      entity: 'Configuração',
      recordId: `condo_${effectiveFromMonth}`,
      auditId: '#CFG-CONDO',
      user: userName,
      details: `Condomínio reajustado para R$ ${newCost.toFixed(2)} com vigência a partir de ${effectiveFromMonth} (mês vigente e futuros). Valor anterior de época: R$ ${prevCostForEffectiveMonth.toFixed(2)}. Novo Fixo por pessoa: R$ ${newPerPerson.toFixed(2)} (era R$ ${oldPerPerson.toFixed(2)}).`
    });
  } catch (e) {
    console.warn('Erro ao registrar log de auditoria:', e);
  }

  // 3. Dispara evento no navegador para atualizar abas
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('financialSettingsUpdated', { detail: updated }));
  }

  // 4. Salva no PocketBase (na nuvem)
  await saveFinancialSettingsToPocketBase(updated);

  return updated;
}

/**
 * Salva as configurações financeiras no localStorage e dispara sincronização com PocketBase
 */
export function saveStoredFinancialSettings(
  partialSettings: Partial<FinancialSettings>,
  userName: string = 'Administrador'
): FinancialSettings {
  const current = getStoredFinancialSettings();
  
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  let history = current.history || [];

  if (typeof partialSettings.condominioCost === 'number' && !isNaN(partialSettings.condominioCost) && partialSettings.condominioCost >= 0) {
    const newCost = partialSettings.condominioCost;
    if (newCost !== current.condominioCost) {
      // Dispara o reajuste com competência
      applyCondominioAdjustment(newCost, currentMonthKey, userName).catch(err => {
        console.warn('Erro ao aplicar reajuste de condomínio no PocketBase:', err);
      });
      return {
        ...current,
        condominioCost: newCost
      };
    }
  }

  const updated: FinancialSettings = {
    condominioCost: typeof partialSettings.condominioCost === 'number' && !isNaN(partialSettings.condominioCost) && partialSettings.condominioCost >= 0
      ? partialSettings.condominioCost
      : current.condominioCost,
    terrenoCost: typeof partialSettings.terrenoCost === 'number' && !isNaN(partialSettings.terrenoCost) && partialSettings.terrenoCost > 0
      ? partialSettings.terrenoCost
      : current.terrenoCost,
    peopleCount: typeof partialSettings.peopleCount === 'number' && !isNaN(partialSettings.peopleCount) && partialSettings.peopleCount > 0
      ? partialSettings.peopleCount
      : current.peopleCount,
    history: partialSettings.history || history,
    partnerFixedInstallments: partialSettings.partnerFixedInstallments || current.partnerFixedInstallments || { ...DEFAULT_PARTNER_FIXED_INSTALLMENTS }
  };

  try {
    localStorage.setItem(FINANCIAL_SETTINGS_STORAGE_KEY, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financialSettingsUpdated', { detail: updated }));
    }

    // Salva na nuvem assincronamente
    saveFinancialSettingsToPocketBase(updated).catch(() => {});
  } catch (err) {
    console.warn('[FinancialSettings] Erro ao salvar configurações:', err);
  }

  return updated;
}

/**
 * Salva as parcelas fixas individuais dos sócios no localStorage, nuvem e emite atualização
 */
export async function savePartnerFixedInstallments(
  installments: Record<Person, PartnerFixedInstallment>,
  userName: string = 'Administrador'
): Promise<FinancialSettings> {
  const current = getStoredFinancialSettings();
  const updated: FinancialSettings = {
    ...current,
    partnerFixedInstallments: installments
  };

  try {
    localStorage.setItem(FINANCIAL_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Erro ao salvar no localStorage:', e);
  }

  // Registra na trilha de auditoria
  try {
    const activePartners = (['Jorge', 'Mccley', 'Jan', 'Saulo'] as Person[])
      .filter(p => installments[p]?.enabled && installments[p]?.value > 0)
      .map(p => `${p}: R$ ${installments[p].value.toFixed(2)}${installments[p].description ? ` (${installments[p].description})` : ''}`);

    auditLogger.logUpdate({
      entity: 'Configuração',
      recordId: 'cfg-partner-fixed-installments',
      auditId: '#CFG-PARC-SOCIOS',
      user: userName,
      actionLabel: 'Parcelas Fixas dos Sócios Atualizadas',
      details: activePartners.length > 0 
        ? `Parcelas fixas ativas: ${activePartners.join(' | ')}`
        : 'Todas as parcelas fixas dos sócios estão desativadas',
      previousValue: 'Configuração anterior',
      newValue: activePartners.join(' | ') || 'Nenhuma'
    });
  } catch (e) {
    console.warn('Erro ao registrar log de auditoria:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('financialSettingsUpdated', { detail: updated }));
  }

  await saveFinancialSettingsToPocketBase(updated);
  return updated;
}

/**
 * Atualiza a parcela fixa de um único sócio
 */
export async function updateSinglePartnerFixedInstallment(
  person: Person,
  enabled: boolean,
  value: number,
  description?: string,
  userName: string = 'Administrador'
): Promise<FinancialSettings> {
  const current = getStoredFinancialSettings();
  const currentMap = { ...(current.partnerFixedInstallments || DEFAULT_PARTNER_FIXED_INSTALLMENTS) };

  currentMap[person] = {
    enabled,
    value: enabled ? (Math.max(0, value) || 0) : 0,
    description: description || '',
    updatedAt: new Date().toISOString(),
    updatedBy: userName
  };

}
 
/**
 * Item discriminado de valores devidos por sócio no mês
 */
export interface MonthlyPartnerDueItem {
  partner: Person;
  totalDue: number;          // Valor final devido por este sócio no mês
  isFixed: boolean;          // true se este sócio estiver sob regime de Parcela Fixa
  fixedValue?: number;       // Valor da parcela fixa configurada (ex: R$ 300,00)
  surplus?: number;          // Saldo gerado = parcela fixa - custo fixo individual
  cardShare: number;         // Cota atribuída da fatura de cartão (após abatimento do saldo)
  fixedCostShare: number;    // Parcela individual de custos fixos (Terreno + Condomínio)
}

/**
 * Resultado completo do rateio mensal por pessoa
 */
export interface MonthlyPartnerDuesResult {
  monthKey: string;
  totalInvoice: number;
  fixedCostsTotal: number;
  fixedCostPerPerson: number;
  hasActivePartnerFixed: boolean;
  hasSauloSplitExpense: boolean;
  dues: Record<Person, MonthlyPartnerDueItem>;
}

/**
 * Calcula o rateio mensal a pagar por cada sócio para um determinado mês (competência).
 * 
 * Regra de Negócio Específica (Casa do Lago):
 * 1. A parcela fixa não deve ser somada (adicionada ao valor).
 * 2. Quando um dos sócios tiver a parcela fixa ativada, no mês vigente em diante ela deve ser
 *    estritamente fixa, desconsiderando os demais valores lançados.
 * 3. Lógica de cálculo com parcela fixa ativada:
 *    - saldo = parcela fixa - custo fixo (terreno + condomínio)
 *    - Este saldo é abatido do total da fatura de cartão daquele mês:
 *      faturaRestante = totalFatura - soma(saldos)
 *    - A faturaRestante é rateada igualmente entre os demais sócios que NÃO possuem parcela fixa ativada:
 *      valorDevidoDemais = custoFixoIndividual + (faturaRestante / totalDemaisSocios)
 * 4. Batimento contábil:
 *    soma(todos os sócios) == Total Fatura de Cartão + Custos Fixos Totais (exato ao centavo).
 */
export function calculateMonthlyPartnerDues(
  monthKey: string,
  cardInvoiceTotal: number,
  settings?: FinancialSettings,
  monthItems?: any[]
): MonthlyPartnerDuesResult {
  const s = settings || getStoredFinancialSettings();
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  const partners: Person[] = ['Jorge', 'Mccley', 'Jan', 'Saulo'];
  const peopleCount = s.peopleCount > 0 ? s.peopleCount : 4;

  const fixedCostPerPerson = calculateFixedPerPersonForMonth(monthKey, s);
  const fixedCostsTotal = calculateFixedCostsForMonth(monthKey, s);

  const pFixed = s.partnerFixedInstallments;
  // A regra de parcela fixa é aplicada no mês vigente em diante (ou em qualquer mês configurado explicitamente)
  const isCurrentOrFuture = monthKey >= currentMonthKey;

  const activeFixedPartners = isCurrentOrFuture && pFixed
    ? partners.filter(p => pFixed[p]?.enabled && Number(pFixed[p].value) > 0)
    : [];

  const hasActivePartnerFixed = activeFixedPartners.length > 0;

  // Verifica se há despesas específicas com split isolado (ex: lançadas especificamente sem o Saulo)
  let cardSauloSplitExpenseTotal = 0;
  let cardNormalExpenseTotal = 0;
  if (monthItems && monthItems.length > 0) {
    monthItems.forEach(it => {
      const isSauloSplit = it.originalExp?.rateioType === 'Parc. Fixa Saulo' || 
        it.originalExp?.observation?.includes('[Parc. Fixa Saulo]');
      if (isSauloSplit) {
        cardSauloSplitExpenseTotal += Number(it.value) || 0;
      } else {
        cardNormalExpenseTotal += Number(it.value) || 0;
      }
    });
  } else {
    cardNormalExpenseTotal = cardInvoiceTotal;
  }
  const hasSauloSplitExpense = cardSauloSplitExpenseTotal > 0.001;

  const dues: Partial<Record<Person, MonthlyPartnerDueItem>> = {};

  if (hasActivePartnerFixed) {
    // -------------------------------------------------------------------------
    // REGRA DE PARCELA FIXA COM ABATIMENTO DO SALDO NA FATURA DOS DEMAIS
    // -------------------------------------------------------------------------
    let totalSurplus = 0;

    // 1. Processa os sócios que possuem parcela fixa ativada
    activeFixedPartners.forEach(p => {
      const fixedVal = Number(pFixed![p].value) || 0;
      const surplus = fixedVal - fixedCostPerPerson;
      totalSurplus += surplus;

      dues[p] = {
        partner: p,
        totalDue: fixedVal,
        isFixed: true,
        fixedValue: fixedVal,
        surplus,
        cardShare: Math.max(0, surplus),
        fixedCostShare: fixedCostPerPerson
      };
    });

    // 2. Processa os demais sócios (sem parcela fixa)
    const remainingPartners = partners.filter(p => !activeFixedPartners.includes(p));

    if (remainingPartners.length > 0) {
      // O saldo é abatido do total da fatura
      const netInvoiceForRemaining = cardInvoiceTotal - totalSurplus;
      const cardSharePerRemaining = netInvoiceForRemaining / remainingPartners.length;

      remainingPartners.forEach(p => {
        const totalDue = fixedCostPerPerson + cardSharePerRemaining;
        dues[p] = {
          partner: p,
          totalDue,
          isFixed: false,
          cardShare: cardSharePerRemaining,
          fixedCostShare: fixedCostPerPerson
        };
      });
    }
  } else if (hasSauloSplitExpense) {
    // Caso legado ou sem parcela fixa geral ativada, respeita despesas lançadas com flag individual
    const cardPerPersonNormal = cardNormalExpenseTotal / peopleCount;
    const cardPerPersonSauloSplit = cardSauloSplitExpenseTotal / 3;

    partners.forEach(p => {
      if (p === 'Saulo') {
        const totalDue = cardPerPersonNormal + fixedCostPerPerson;
        dues[p] = {
          partner: p,
          totalDue,
          isFixed: false,
          cardShare: cardPerPersonNormal,
          fixedCostShare: fixedCostPerPerson
        };
      } else {
        const totalDue = cardPerPersonNormal + cardPerPersonSauloSplit + fixedCostPerPerson;
        dues[p] = {
          partner: p,
          totalDue,
          isFixed: false,
          cardShare: cardPerPersonNormal + cardPerPersonSauloSplit,
          fixedCostShare: fixedCostPerPerson
        };
      }
    });
  } else {
    // Rateio padrão: divisão igual entre todos os 4 sócios
    const cardPerPerson = cardInvoiceTotal / peopleCount;
    partners.forEach(p => {
      const totalDue = cardPerPerson + fixedCostPerPerson;
      dues[p] = {
        partner: p,
        totalDue,
        isFixed: false,
        cardShare: cardPerPerson,
        fixedCostShare: fixedCostPerPerson
      };
    });
  }

  return {
    monthKey,
    totalInvoice: cardInvoiceTotal,
    fixedCostsTotal,
    fixedCostPerPerson,
    hasActivePartnerFixed,
    hasSauloSplitExpense,
    dues: dues as Record<Person, MonthlyPartnerDueItem>
  };
}

