/**
 * Módulo de Gestão de Categorias de Despesas
 * Projeto Casa do Lago - Sistema de Gestão Financeira
 */

export const DEFAULT_CATEGORIES: string[] = [
  'Combustível',
  'Documentação',
  'Material',
  'Mão de Obra',
  'Monitoramento',
  'Alimentação'
];

export const CATEGORIES_STORAGE_KEY = 'casadolago_custom_categories';

/**
 * Normaliza o nome da categoria com a primeira letra maiúscula e sem espaços excedentes
 */
export function sanitizeCategoryName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Obtém as categorias armazenadas em localStorage com fallback para as categorias padrão
 */
export function getStoredCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) return [...DEFAULT_CATEGORIES];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sanitizedList = parsed
        .map((c: any) => sanitizeCategoryName(String(c)))
        .filter(Boolean);
      
      const unique = Array.from(new Set(sanitizedList));
      return unique.length > 0 ? unique : [...DEFAULT_CATEGORIES];
    }
  } catch (err) {
    console.warn('[Categories] Erro ao carregar categorias do localStorage:', err);
  }
  return [...DEFAULT_CATEGORIES];
}

/**
 * Salva a lista de categorias no localStorage
 */
export function saveStoredCategories(categories: string[]): void {
  try {
    const sanitizedList = categories
      .map(c => sanitizeCategoryName(c))
      .filter(Boolean);
    const unique = Array.from(new Set(sanitizedList));
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(unique));
  } catch (err) {
    console.warn('[Categories] Erro ao salvar categorias no localStorage:', err);
  }
}

/**
 * Mescla as categorias salvas com quaisquer categorias presentes nas despesas existentes,
 * garantindo integridade e descoberta automática de categorias criadas em outros clientes.
 */
export function mergeCategoriesWithExpenses(
  stored: string[],
  expenses: Array<{ category?: string }>
): string[] {
  const set = new Set<string>();

  // 1. Categorias salvas
  stored.forEach(c => {
    const s = sanitizeCategoryName(c);
    if (s) set.add(s);
  });

  // 2. Garante que categorias padrão permaneçam se a lista estiver incompleta
  DEFAULT_CATEGORIES.forEach(c => set.add(c));

  // 3. Categorias descobertas de despesas carregadas
  expenses.forEach(e => {
    if (e.category) {
      const s = sanitizeCategoryName(e.category);
      if (s) set.add(s);
    }
  });

  return Array.from(set);
}
