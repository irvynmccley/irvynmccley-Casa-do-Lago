/**
 * Módulo de Gestão de Configurações Financeiras e Custos Fixos
 * Projeto Casa do Lago - Sistema de Gestão Financeira
 */

import { auditLogger } from './auditLogger';

export interface FinancialSettings {
  condominioCost: number;
  terrenoCost: number;
  peopleCount: number;
}

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  condominioCost: 50.00,
  terrenoCost: 700.00,
  peopleCount: 4 // Jorge, Mccley, Jan, Saulo
};

export const FINANCIAL_SETTINGS_STORAGE_KEY = 'casadolago_financial_settings';

/**
 * Obtém as configurações financeiras do localStorage com fallback para valores padrão
 */
export function getStoredFinancialSettings(): FinancialSettings {
  try {
    const raw = localStorage.getItem(FINANCIAL_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FINANCIAL_SETTINGS };
    
    const parsed = JSON.parse(raw);
    const condominioCost = typeof parsed.condominioCost === 'number' && !isNaN(parsed.condominioCost) && parsed.condominioCost >= 0
      ? parsed.condominioCost
      : DEFAULT_FINANCIAL_SETTINGS.condominioCost;
      
    const terrenoCost = typeof parsed.terrenoCost === 'number' && !isNaN(parsed.terrenoCost) && parsed.terrenoCost > 0
      ? parsed.terrenoCost
      : DEFAULT_FINANCIAL_SETTINGS.terrenoCost;
      
    const peopleCount = typeof parsed.peopleCount === 'number' && !isNaN(parsed.peopleCount) && parsed.peopleCount > 0
      ? parsed.peopleCount
      : DEFAULT_FINANCIAL_SETTINGS.peopleCount;

    return {
      condominioCost,
      terrenoCost,
      peopleCount
    };
  } catch (err) {
    console.warn('[FinancialSettings] Erro ao carregar configurações do localStorage:', err);
    return { ...DEFAULT_FINANCIAL_SETTINGS };
  }
}

/**
 * Salva as configurações financeiras no localStorage e registra na trilha de auditoria
 */
export function saveStoredFinancialSettings(
  partialSettings: Partial<FinancialSettings>,
  userName: string = 'Administrador'
): FinancialSettings {
  const current = getStoredFinancialSettings();
  
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
  };

  try {
    localStorage.setItem(FINANCIAL_SETTINGS_STORAGE_KEY, JSON.stringify(updated));

    // Se o condomínio foi alterado, registra auditoria detalhada
    if (updated.condominioCost !== current.condominioCost) {
      const oldTotal = current.terrenoCost + current.condominioCost;
      const newTotal = updated.terrenoCost + updated.condominioCost;
      const oldPerPerson = oldTotal / current.peopleCount;
      const newPerPerson = newTotal / updated.peopleCount;

      auditLogger.log({
        action: 'UPDATE',
        actionLabel: 'Reajuste de Condomínio',
        entity: 'Configuração',
        recordId: 'condominio_cost',
        auditId: '#CFG-CONDO',
        user: userName,
        details: `Condomínio reajustado de R$ ${current.condominioCost.toFixed(2)} para R$ ${updated.condominioCost.toFixed(2)}. Novo Fixo Total: R$ ${newTotal.toFixed(2)} (R$ ${newPerPerson.toFixed(2)}/pessoa).`
      });
    }

    // Dispara evento customizado para sincronização entre componentes no mesmo tab ou abas
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financialSettingsUpdated', { detail: updated }));
    }
  } catch (err) {
    console.warn('[FinancialSettings] Erro ao salvar configurações no localStorage:', err);
  }

  return updated;
}

/**
 * Calcula o custo fixo total mensal (Terreno + Condomínio)
 */
export function calculateFixedCosts(settings: FinancialSettings): number {
  return settings.terrenoCost + settings.condominioCost;
}

/**
 * Calcula o valor fixo por pessoa (Custo Fixo Total ÷ Número de Sócios)
 */
export function calculateFixedPerPerson(settings: FinancialSettings): number {
  const total = calculateFixedCosts(settings);
  const count = settings.peopleCount > 0 ? settings.peopleCount : 4;
  return total / count;
}
