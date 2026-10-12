/**
 * Módulo de Gestão de Configurações Financeiras, Custos Fixos e Histórico de Reajustes
 * Projeto Casa do Lago - Sistema de Gestão Financeira
 */

import { auditLogger } from './auditLogger';
import { pb } from '../pocketbaseClient';
import { format } from 'date-fns';

export interface CondominioAdjustment {
  effectiveFrom: string; // Formato 'YYYY-MM' (ex: '2024-02', '2026-10')
  condominioCost: number; // Valor da taxa mensal a partir deste mês
  createdAt?: string;    // Data/hora ISO da alteração
  createdBy?: string;    // Usuário que realizou o reajuste
  notes?: string;        // Observação ou motivo do reajuste
}

export interface FinancialSettings {
  condominioCost: number; // Taxa mensal do mês vigente
  terrenoCost: number;    // Parcela mensal do terreno (R$ 700,00)
  peopleCount: number;    // Número de sócios no rateio (padrão: 4)
  history: CondominioAdjustment[]; // Histórico cronológico de vigências
}

export const BASELINE_CONDOMINIO_DATE = '2024-02'; // Início do financiamento da Casa do Lago

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
  ]
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

  return {
    condominioCost: activeCost,
    terrenoCost,
    peopleCount,
    history
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
    history: partialSettings.history || history
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
