import React from 'react';
import { Download, Database, FileSpreadsheet, FileText } from 'lucide-react';
import { AppState } from '../types';
import * as XLSX from 'xlsx';

interface ConfigTabProps {
  state: AppState;
}

export function ConfigTab({ state }: ConfigTabProps) {
  const handleBackupJSON = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    
    const date = new Date().toISOString().split('T')[0];
    link.download = `backup_casadolago_${date}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBackupCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Expenses
    csvContent += "--- SAÍDAS ---\n";
    csvContent += "ID,Data,Categoria,Local,Valor,Forma de Pagamento,Parcelas,Doador,Observação\n";
    state.expenses.forEach(e => {
      const row = [
        e.id, 
        e.date, 
        e.category, 
        `"${(e.local || '').replace(/"/g, '""')}"`, 
        e.value, 
        e.paymentMethod, 
        e.installments || '', 
        e.donor || '', 
        `"${(e.observation || '').replace(/"/g, '""')}"`
      ].join(",");
      csvContent += row + "\n";
    });
    csvContent += "\n";

    // Incomes
    csvContent += "--- ENTRADAS ---\n";
    csvContent += "ID,Data,Valor,Descrição,É Caixa?\n";
    state.incomes.forEach(i => {
      const row = [
        i.id,
        i.date,
        i.value,
        `"${(i.description || '').replace(/"/g, '""')}"`,
        i.isCaixa ? 'Sim' : 'Não'
      ].join(",");
      csvContent += row + "\n";
    });
    csvContent += "\n";

    // Payments
    csvContent += "--- PAGAMENTOS ---\n";
    csvContent += "ID,Data,Valor,Pessoa\n";
    state.payments.forEach(p => {
      const row = [
        p.id,
        p.date,
        p.value,
        p.person
      ].join(",");
      csvContent += row + "\n";
    });
    csvContent += "\n";

    // Terreno
    csvContent += "--- TERRENO ---\n";
    csvContent += "ID da Parcela Paga\n";
    state.terrenoPaidInstallments.forEach(t => {
      csvContent += `${t}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `backup_completo_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackupExcel = () => {
    const wb = XLSX.utils.book_new();

    // Expenses Sheet
    const expensesData = state.expenses.map(e => ({
      ID: e.id,
      Data: e.date,
      Categoria: e.category,
      Local: e.local,
      Valor: e.value,
      'Forma de Pagamento': e.paymentMethod,
      Parcelas: e.installments || '',
      Doador: e.donor || '',
      Observação: e.observation || ''
    }));
    const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(wb, wsExpenses, "Saídas");

    // Incomes Sheet
    const incomesData = state.incomes.map(i => ({
      ID: i.id,
      Data: i.date,
      Valor: i.value,
      Descrição: i.description,
      'É Caixa?': i.isCaixa ? 'Sim' : 'Não'
    }));
    const wsIncomes = XLSX.utils.json_to_sheet(incomesData);
    XLSX.utils.book_append_sheet(wb, wsIncomes, "Entradas");

    // Payments Sheet
    const paymentsData = state.payments.map(p => ({
      ID: p.id,
      Data: p.date,
      Valor: p.value,
      Pessoa: p.person
    }));
    const wsPayments = XLSX.utils.json_to_sheet(paymentsData);
    XLSX.utils.book_append_sheet(wb, wsPayments, "Pagamentos");

    // Terreno Sheet
    const terrenoData = state.terrenoPaidInstallments.map(t => ({
      'ID da Parcela Paga': t
    }));
    const wsTerreno = XLSX.utils.json_to_sheet(terrenoData);
    XLSX.utils.book_append_sheet(wb, wsTerreno, "Terreno");

    // Save
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `backup_casadolago_${date}.xlsx`);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-white drop-shadow-sm">Configurações</h2>
          <p className="text-slate-400 font-medium tracking-wide">Gerencie as configurações do sistema e backups</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-xl p-6 ring-1 ring-white/5 hover:bg-slate-800/60 transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl ring-1 ring-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
              <Database size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1 text-white">Backup Completo (JSON)</h3>
              <p className="text-sm text-slate-400 mb-5">
                Exporte todos os dados do sistema em um único arquivo JSON. Ideal para restauração futura ou migração.
              </p>
              <button
                onClick={handleBackupJSON}
                className="flex items-center justify-center gap-2 w-full sm:w-auto bg-slate-800 text-slate-200 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-700 hover:text-white transition-all ring-1 ring-slate-600/50"
              >
                <Download size={18} />
                Baixar JSON
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-xl p-6 ring-1 ring-white/5 hover:bg-slate-800/60 transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl ring-1 ring-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <FileSpreadsheet size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1 text-white">Exportar Planilhas</h3>
              <p className="text-sm text-slate-400 mb-5">
                Baixe todos os lançamentos em um único arquivo para visualizar no Excel ou Google Sheets.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleBackupExcel}
                  className="flex items-center justify-center gap-2 flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-xl font-bold hover:from-emerald-500 hover:to-teal-500 transition-all ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-500/20"
                >
                  <FileSpreadsheet size={18} />
                  Baixar Excel (.xlsx)
                </button>
                <button
                  onClick={handleBackupCSV}
                  className="flex items-center justify-center gap-2 flex-1 bg-slate-800 text-slate-300 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-700 hover:text-white transition-all ring-1 ring-slate-600/50"
                >
                  <FileText size={18} />
                  Baixar CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
