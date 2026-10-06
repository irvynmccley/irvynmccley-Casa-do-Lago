import React, { useState } from 'react';
import { 
  CheckCircle, 
  Circle, 
  Map, 
  ChevronDown, 
  ChevronUp, 
  Share2, 
  FileText, 
  Paperclip, 
  Upload, 
  Eye,
  Building2
} from 'lucide-react';
import { Card } from './ui/Card';
import { formatAuditId, copyAuditIdToClipboard } from '../utils/audit';
import { TerrenoReceiptModal } from './TerrenoReceiptModal';
import { TerrenoVendorShareModal } from './TerrenoVendorShareModal';
import type { TerrenoInstallmentRecord } from '../types';

interface TerrenoInstallment {
  id: string; // e.g., "2024-02"
  date: Date;
  value: number;
}

interface TerrenoTabProps {
  paidInstallments: string[];
  installmentsData?: Record<string, TerrenoInstallmentRecord>;
  onTogglePayment: (id: string, paymentData?: { file?: File; receipt_url?: string; receipt_name?: string; notes?: string }) => void;
  onRemovePayment?: (id: string) => void;
  onUpdateReceipt?: (id: string, receiptData: { file?: File; receipt_url?: string; receipt_name?: string; notes?: string }) => void;
  formatCurrency: (v: number) => string;
  isVendorMode?: boolean;
}

export function TerrenoTab({ 
  paidInstallments, 
  installmentsData = {},
  onTogglePayment, 
  onRemovePayment,
  onUpdateReceipt,
  formatCurrency,
  isVendorMode = false
}: TerrenoTabProps) {
  const [showPaid, setShowPaid] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  // Modal de Comprovante
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptModalMode, setReceiptModalMode] = useState<'view' | 'pay' | 'attach'>('view');
  const [activeInstallment, setActiveInstallment] = useState<{
    id: string;
    monthName: string;
    year: number;
    date: Date;
    value: number;
    auditId: string;
  } | null>(null);

  // Gerar parcelas cronológicas
  const installments: TerrenoInstallment[] = [];
  let currentDate = new Date(2024, 1, 25); // 25 de Fev de 2024
  let remainingDebt = 40000;

  while (remainingDebt > 0) {
    const paymentValue = Math.min(700, remainingDebt);
    const id = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    installments.push({
      id,
      date: new Date(currentDate),
      value: paymentValue
    });

    remainingDebt -= paymentValue;
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  const safePaidInstallments = paidInstallments || [];
  
  const totalPaid = installments
    .filter(i => safePaidInstallments.includes(i.id))
    .reduce((acc, curr) => acc + curr.value, 0);
    
  const currentBalance = 40000 - totalPaid;

  const paidItems = installments.filter(i => safePaidInstallments.includes(i.id));
  const unpaidItems = installments.filter(i => !safePaidInstallments.includes(i.id));

  const handleOpenReceiptModal = (
    installment: TerrenoInstallment, 
    mode: 'view' | 'pay' | 'attach'
  ) => {
    const monthName = installment.date.toLocaleString('pt-BR', { month: 'long' });
    const year = installment.date.getFullYear();
    const auditId = formatAuditId('TER', installment.id);

    setActiveInstallment({
      id: installment.id,
      monthName,
      year,
      date: installment.date,
      value: installment.value,
      auditId
    });
    setReceiptModalMode(mode);
    setReceiptModalOpen(true);
  };

  const handleConfirmPaymentWithData = (data: { file?: File; receipt_url?: string; receipt_name?: string; notes?: string }) => {
    if (!activeInstallment) return;
    onTogglePayment(activeInstallment.id, data);
  };

  const handleConfirmWithoutReceipt = () => {
    if (!activeInstallment) return;
    onTogglePayment(activeInstallment.id);
  };

  const handleSaveUpdateReceipt = (data: { file?: File; receipt_url?: string; receipt_name?: string; notes?: string }) => {
    if (!activeInstallment) return;
    if (onUpdateReceipt) {
      onUpdateReceipt(activeInstallment.id, data);
    } else {
      onTogglePayment(activeInstallment.id, data);
    }
  };

  const handleRemoveReceiptOnly = () => {
    if (!activeInstallment) return;
    if (onUpdateReceipt) {
      onUpdateReceipt(activeInstallment.id, { receipt_url: '', receipt_name: '' });
    }
  };

  const handleUnmarkInstallment = (id: string) => {
    if (onRemovePayment) {
      onRemovePayment(id);
    } else {
      onTogglePayment(id);
    }
  };

  const renderInstallment = (installment: TerrenoInstallment, index: number, isPaid: boolean) => {
    const monthName = installment.date.toLocaleString('pt-BR', { month: 'long' });
    const year = installment.date.getFullYear();
    const auditId = formatAuditId('TER', installment.id);
    const receiptData = installmentsData[installment.id];
    const hasReceipt = Boolean(receiptData?.receipt_url || receiptData?.receipt_file);
    
    return (
      <div 
        key={installment.id} 
        className="flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-800/80 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-800/40 transition-all gap-2 sm:gap-4 group ring-1 ring-white/5"
      >
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-800/90 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shadow-sm">
            {index + 1}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-semibold text-slate-200 capitalize text-xs sm:text-sm truncate leading-tight">
                {monthName} {year}
              </span>
              <button
                type="button"
                onClick={(e) => copyAuditIdToClipboard(auditId, e)}
                title="Clique para copiar ID de auditoria"
                className="font-mono text-[9px] sm:text-[10px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 px-1.5 py-0.5 rounded transition-all active:scale-95 inline-flex items-center"
              >
                {auditId}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                Venc. 25/{String(installment.date.getMonth() + 1).padStart(2, '0')}/{year}
              </p>
              {receiptData?.notes && (
                <span className="hidden sm:inline-block text-[10px] text-slate-400 italic truncate max-w-[140px]" title={receiptData.notes}>
                  • {receiptData.notes}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="font-mono font-bold text-slate-200 text-xs sm:text-sm">
            {formatCurrency(installment.value)}
          </span>

          {/* Botão de Comprovante */}
          {isPaid && (
            <>
              {hasReceipt ? (
                <button
                  type="button"
                  onClick={() => handleOpenReceiptModal(installment, 'view')}
                  className="flex items-center gap-1 sm:gap-1.5 text-blue-300 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 px-2 sm:px-2.5 py-1 rounded-lg transition-all text-[11px] sm:text-xs font-bold active:scale-95 shadow-sm"
                  title="Visualizar e baixar comprovante"
                >
                  <FileText size={13} className="shrink-0 text-emerald-400" />
                  <span className="hidden xs:inline">Comprovante</span>
                  <span className="xs:hidden">Ver</span>
                </button>
              ) : (
                !isVendorMode && (
                  <button
                    type="button"
                    onClick={() => handleOpenReceiptModal(installment, 'attach')}
                    className="flex items-center gap-1 text-slate-400 hover:text-blue-400 bg-slate-800/40 hover:bg-blue-500/10 border border-slate-700/60 hover:border-blue-500/30 px-2 py-1 rounded-lg transition-all text-[11px] font-medium active:scale-95"
                    title="Anexar comprovante a esta parcela"
                  >
                    <Upload size={12} className="shrink-0" />
                    <span className="hidden sm:inline">+ Anexo</span>
                  </button>
                )
              )}
            </>
          )}

          {/* Status / Botão de Ação */}
          {isPaid ? (
            isVendorMode ? (
              <button
                type="button"
                onClick={() => hasReceipt ? handleOpenReceiptModal(installment, 'view') : null}
                className={`flex items-center gap-1 sm:gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 text-[11px] sm:text-xs font-semibold ${hasReceipt ? 'hover:bg-emerald-500/20 active:scale-95 cursor-pointer' : ''}`}
                title={hasReceipt ? "Visualizar comprovante desta parcela" : "Parcela liquidada"}
              >
                <CheckCircle size={14} className="shrink-0" />
                <span>Pago</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Deseja desmarcar o pagamento da parcela ${monthName} ${year}?`)) {
                    handleUnmarkInstallment(installment.id);
                  }
                }}
                title="Clique para desmarcar parcela"
                className="flex items-center gap-1 sm:gap-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 sm:px-2.5 py-1 rounded-lg border border-emerald-500/20 transition-all text-[11px] sm:text-xs font-semibold active:scale-95"
              >
                <CheckCircle size={14} className="shrink-0" />
                <span>Pago</span>
              </button>
            )
          ) : (
            isVendorMode ? (
              <span className="flex items-center gap-1 sm:gap-1.5 text-slate-400 bg-slate-800/40 px-2.5 py-1 rounded-lg border border-slate-700/60 text-[11px] sm:text-xs font-medium">
                <Circle size={13} className="shrink-0" />
                <span>A Vencer</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenReceiptModal(installment, 'pay')}
                className="flex items-center gap-1 sm:gap-1.5 text-slate-400 hover:text-emerald-400 bg-slate-800/60 hover:bg-emerald-500/10 px-2 sm:px-2.5 py-1 rounded-lg transition-all border border-slate-700/80 hover:border-emerald-500/30 text-[11px] sm:text-xs font-semibold active:scale-95"
                title="Registrar pagamento desta parcela"
              >
                <Circle size={14} className="shrink-0" />
                <span>Pagar</span>
              </button>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      {/* Header da Tela */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-sm">
              {isVendorMode ? 'Extrato de pagamento Terreno' : 'Terreno'}
            </h2>
            {!isVendorMode && (
              <span className="text-xs font-mono font-medium text-slate-400 bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 rounded-lg">
                58 parcelas • R$ 700/mês
              </span>
            )}
          </div>
          <p className="text-slate-400 font-medium tracking-wide text-xs sm:text-sm mt-1">
            {isVendorMode 
              ? 'Acompanhamento de parcelas pagas, saldo devedor e comprovantes anexados' 
              : 'Acompanhamento do financiamento do terreno e gestão de comprovantes'}
          </p>
        </div>

        {/* Botão de Compartilhar Link do Vendedor (visível apenas para administradores/sócios) */}
        {!isVendorMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Gerar link de acesso fácil para o vendedor acompanhar as parcelas"
            >
              <Share2 size={15} className="text-blue-400" />
              <span>Link do Vendedor</span>
            </button>
          </div>
        )}
      </header>

      {/* CARDS DE RESUMO FINANCEIRO */}
      {isVendorMode ? (
        /* VISTA DO VENDEDOR: O BANNER COM VALORES DE ZAIRA FOI 100% REMOVIDO! Apenas Saldo Devedor, Total Pago e Valor do Terreno */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <Card className="bg-slate-900/60 backdrop-blur-xl border border-red-500/30 ring-1 ring-red-500/10 shadow-xl p-5 sm:p-6 flex flex-col justify-between h-full hover:bg-slate-800/60 transition-colors">
            <div>
              <div className="flex items-center gap-3 text-red-300 mb-3">
                <Circle size={18} className="text-red-400" />
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider">Saldo Devedor</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 font-mono">
                {formatCurrency(currentBalance)}
              </div>
            </div>
            <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-3 flex justify-between items-center">
              <span>Restante a liquidar:</span>
              <span className="font-semibold text-slate-300">{unpaidItems.length} parcelas</span>
            </div>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-xl border border-emerald-500/30 ring-1 ring-emerald-500/10 shadow-xl p-5 sm:p-6 flex flex-col justify-between h-full hover:bg-slate-800/60 transition-colors">
            <div>
              <div className="flex items-center gap-3 text-emerald-300 mb-3">
                <CheckCircle size={18} className="text-emerald-400" />
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider">Total Pago</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 font-mono">
                {formatCurrency(totalPaid)}
              </div>
            </div>
            <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-3 flex justify-between items-center">
              <span>Parcelas liquidadas:</span>
              <span className="font-semibold text-emerald-400">{paidItems.length} parcelas</span>
            </div>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-xl border border-blue-500/30 ring-1 ring-blue-500/10 shadow-xl p-5 sm:p-6 flex flex-col justify-between h-full hover:bg-slate-800/60 transition-colors">
            <div>
              <div className="flex items-center gap-3 text-blue-300 mb-3">
                <Map size={18} className="text-blue-400" />
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider">Valor do Terreno</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 font-mono">
                {formatCurrency(40000)}
              </div>
            </div>
            <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-3 flex justify-between items-center">
              <span>Contrato parcelado:</span>
              <span className="font-semibold text-blue-300">58 parcelas (R$ 700/mês)</span>
            </div>
          </Card>
        </div>
      ) : (
        /* VISTA PADRÃO DOS SÓCIOS / ADMINISTRADORES: Inclui o banner completo de Valor Total da Obra e Terreno */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 shadow-xl p-6 flex flex-col justify-between h-full hover:bg-slate-800/60 transition-colors">
            <div>
              <div className="flex items-center gap-3 text-slate-300 mb-4">
                <Map size={18} className="text-emerald-400" />
                <span className="text-sm font-medium uppercase tracking-wider">Valor Total</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-4">
                {formatCurrency(62451.92)}
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-slate-400 border-t border-slate-700/50 pt-4">
              <div className="flex justify-between">
                <span>Zaira:</span>
                <span className="font-medium text-slate-200">{formatCurrency(20504.03)}</span>
              </div>
              <div className="flex justify-between">
                <span>Juros Zaira:</span>
                <span className="font-medium text-slate-200">{formatCurrency(1947.89)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cris (parcelado):</span>
                <span className="font-medium text-slate-200">{formatCurrency(40000)}</span>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 shadow-xl p-6 flex flex-col justify-between h-full hover:bg-slate-800/60 transition-colors">
            <div className="flex items-center gap-3 text-slate-300 mb-4">
              <CheckCircle size={18} className="text-blue-400" />
              <span className="text-sm font-medium uppercase tracking-wider">Total Pago</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
              {formatCurrency(totalPaid)}
            </div>
            <p className="text-xs text-slate-400">{paidItems.length} de {installments.length} parcelas quitadas</p>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 shadow-xl p-6 flex flex-col justify-between h-full hover:bg-slate-800/60 transition-colors">
            <div className="flex items-center gap-3 text-slate-300 mb-4">
              <Circle size={18} className="text-red-400" />
              <span className="text-sm font-medium uppercase tracking-wider">Saldo Devedor</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
              {formatCurrency(currentBalance)}
            </div>
            <p className="text-xs text-slate-400">Restante para quitação do terreno</p>
          </Card>
        </div>
      )}

      {/* LINHA DO TEMPO DE PAGAMENTOS */}
      <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 shadow-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-700/50 bg-slate-950/30 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Linha do Tempo de Pagamentos</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isVendorMode 
                ? 'Clique em "Comprovante" para visualizar e baixar os arquivos anexados'
                : 'Clique no ID para copiar, no status para alternar ou anexe comprovantes'}
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
            {paidItems.length}/{installments.length} Pagas
          </span>
        </div>

        <div className="p-3 sm:p-5">
          <div className="space-y-4">
            {/* Seção de Parcelas Pagas (Accordion expansível) */}
            {paidItems.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowPaid(!showPaid)}
                  className="flex items-center gap-2 text-slate-300 font-bold hover:text-white transition-colors bg-slate-800/50 px-3.5 py-1.5 rounded-xl ring-1 ring-slate-700/50 text-xs sm:text-sm active:scale-95"
                >
                  {showPaid ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  Parcelas Pagas ({paidItems.length})
                </button>

                {showPaid && (
                  <div className="space-y-1.5 sm:space-y-2 animate-in slide-in-from-top-2 duration-300 pt-1">
                    {paidItems.map((installment) => {
                      const index = installments.findIndex(i => i.id === installment.id);
                      return renderInstallment(installment, index, true);
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Seção de Próximos Vencimentos */}
            {unpaidItems.length > 0 && (
              <div className="space-y-2">
                {paidItems.length > 0 && (
                  <h4 className="text-slate-300 font-bold text-xs uppercase tracking-wider mt-4 mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Próximos Vencimentos ({unpaidItems.length})
                  </h4>
                )}
                <div className="space-y-1.5 sm:space-y-2">
                  {unpaidItems.map((installment) => {
                    const index = installments.findIndex(i => i.id === installment.id);
                    return renderInstallment(installment, index, false);
                  })}
                </div>
              </div>
            )}

            {installments.length === 0 && (
              <p className="text-slate-500 text-center py-4 text-sm">Nenhuma parcela gerada.</p>
            )}
          </div>
        </div>
      </Card>

      {/* Modal de Comprovante de Pagamento (Visualizar / Anexar) */}
      {activeInstallment && (
        <TerrenoReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          mode={receiptModalMode}
          installment={activeInstallment}
          receiptData={installmentsData[activeInstallment.id]}
          formatCurrency={formatCurrency}
          onConfirmPayment={handleConfirmPaymentWithData}
          onConfirmWithoutReceipt={handleConfirmWithoutReceipt}
          onUpdateReceipt={handleSaveUpdateReceipt}
          onRemoveReceipt={handleRemoveReceiptOnly}
          onUnmarkPayment={() => handleUnmarkInstallment(activeInstallment.id)}
          isVendorMode={isVendorMode}
        />
      )}

      {/* Modal de Compartilhamento com o Vendedor */}
      <TerrenoVendorShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
}
