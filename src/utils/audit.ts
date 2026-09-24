import { toast } from 'sonner';

export type EntityType = 'EXP' | 'REC' | 'PAG' | 'TER' | 'SYS';

/**
 * Retorna um Código de Auditoria padronizado, legível e determinístico para qualquer lançamento.
 * Preserva 100% os IDs originais do PocketBase / SQLite sem requerer migração no banco de dados.
 *
 * Exemplos:
 * - Saída: #EXP-8F29DA
 * - Entrada: #REC-4E10BC
 * - Pagamento: #PAG-92D01F
 * - Terreno: #TER-202402
 */
export function formatAuditId(type: EntityType, id: string | undefined | null): string {
  if (!id) return `#${type}-000000`;

  // Se já tiver formato especial (como parcela de terreno "2024-02")
  if (type === 'TER') {
    const cleanTerreno = id.replace(/[^0-9]/g, '');
    if (cleanTerreno.length >= 6) {
      return `#TER-${cleanTerreno.slice(0, 6)}`;
    }
    return `#TER-${id.toUpperCase()}`;
  }

  // Se for ID temporário gerado offline (ex: "temp-1727209384912")
  if (id.startsWith('temp-')) {
    const suffix = id.replace('temp-', '').slice(-6).toUpperCase();
    return `#${type}-${suffix}`;
  }

  // ID do PocketBase (alfanumérico de 15 caracteres) ou UUID
  // Remove hífens e pega os primeiros 6 caracteres em maiúsculas
  const clean = id.replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length >= 6) {
    return `#${type}-${clean.slice(0, 6).toUpperCase()}`;
  }

  return `#${type}-${clean.padEnd(6, '0').toUpperCase()}`;
}

/**
 * Copia o ID de auditoria para a área de transferência com feedback visual (Toast).
 */
export async function copyAuditIdToClipboard(auditId: string, event?: React.MouseEvent) {
  if (event) {
    event.stopPropagation();
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(auditId);
      toast.success(`ID ${auditId} copiado para a área de transferência!`, {
        duration: 2000,
      });
    } else {
      // Fallback para navegadores sem permissão de clipboard direto
      const textArea = document.createElement('textarea');
      textArea.value = auditId;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success(`ID ${auditId} copiado!`, { duration: 2000 });
    }
  } catch (err) {
    console.warn('Não foi possível copiar o ID:', err);
    toast.error('Erro ao copiar ID');
  }
}
