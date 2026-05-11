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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Configurações</h2>
          <p className="text-black">Gerencie as configurações do sistema e backups</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Database size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1">Backup Completo (JSON)</h3>
              <p className="text-sm text-gray-600 mb-4">
                Exporte todos os dados do sistema em um único arquivo JSON. Ideal para restauração futura ou migração.
              </p>
              <button
                onClick={handleBackupJSON}
                className="flex items-center gap-2 bg-[#0a192f] text-white px-4 py-2 rounded-xl font-medium hover:bg-[#112240] transition-colors"
              >
                <Download size={18} />
                Baixar JSON
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileSpreadsheet size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1">Exportar Planilhas</h3>
              <p className="text-sm text-gray-600 mb-4">
                Baixe todos os lançamentos em um único arquivo para visualizar no Excel ou Google Sheets.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleBackupExcel}
                  className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                >
                  <FileSpreadsheet size={18} />
                  Baixar Excel (.xlsx)
                </button>
                <button
                  onClick={handleBackupCSV}
                  className="flex items-center justify-center gap-2 bg-gray-100 text-gray-800 px-4 py-2 rounded-xl font-medium hover:bg-gray-200 transition-colors"
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
