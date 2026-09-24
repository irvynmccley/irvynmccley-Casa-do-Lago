export type AuditActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC' | 'PAYMENT';

export interface AuditLogEntry {
  id: string; // ID único do log
  timestamp: string; // ISO date string
  action: AuditActionType;
  actionLabel: string; // 'Lançamento Criado', 'Lançamento Editado', 'Exclusão', etc.
  entity: 'Saída' | 'Entrada' | 'Pagamento' | 'Terreno' | 'Sistema';
  recordId: string;
  auditId: string; // e.g. #EXP-9B214A
  user: string;
  details: string;
  previousValue?: string;
  newValue?: string;
}

const STORAGE_KEY = 'casadolago_audit_logs';
const MAX_LOGS = 500;

export const auditLogger = {
  getLogs(): AuditLogEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Erro ao ler logs de auditoria:', e);
      return [];
    }
  },

  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    try {
      const logs = this.getLogs();
      const newEntry: AuditLogEntry = {
        ...entry,
        id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        timestamp: new Date().toISOString(),
      };

      const updated = [newEntry, ...logs].slice(0, MAX_LOGS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Dispara um evento para componentes ouvintes se atualizarem dinamicamente
      window.dispatchEvent(new CustomEvent('casadolago_log_added', { detail: newEntry }));

      return newEntry;
    } catch (e) {
      console.error('Erro ao registrar log de auditoria:', e);
      return {
        ...entry,
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }
  },

  clearLogs(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('casadolago_log_added', { detail: null }));
    } catch (e) {
      console.error('Erro ao limpar logs:', e);
    }
  },

  exportLogsJSON(): void {
    const logs = this.getLogs();
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.download = `logs_auditoria_casadolago_${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  exportLogsCSV(): void {
    const logs = this.getLogs();
    let csv = '\uFEFF'; // UTF-8 BOM para abrir com acentuação correta no Excel
    csv += 'ID do Log,Data/Hora,Ação,Entidade,Código Auditoria,ID Original,Usuário,Detalhes\n';

    logs.forEach(l => {
      const dateFormatted = new Date(l.timestamp).toLocaleString('pt-BR');
      const row = [
        l.id,
        `"${dateFormatted}"`,
        `"${l.actionLabel || l.action}"`,
        `"${l.entity}"`,
        `"${l.auditId}"`,
        `"${l.recordId}"`,
        `"${l.user || 'Sistema'}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
      ].join(',');
      csv += row + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.download = `logs_auditoria_casadolago_${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
