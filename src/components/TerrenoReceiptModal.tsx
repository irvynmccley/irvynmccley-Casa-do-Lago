import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Download, 
  Share2, 
  Copy, 
  Trash2, 
  ExternalLink, 
  AlertCircle,
  Eye,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  readFileAsDataUrl, 
  downloadReceiptFile, 
  getReceiptWhatsAppShareText 
} from '../utils/terrenoStorage';
import { copyAuditIdToClipboard } from '../utils/audit';

export interface TerrenoReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'view' | 'pay' | 'attach';
  installment: {
    id: string; // e.g. "2024-02"
    monthName: string;
    year: number;
    date: Date;
    value: number;
    auditId: string;
  };
  receiptData?: {
    receipt_url?: string;
    receipt_name?: string;
    notes?: string;
    paid_at?: string;
  };
  formatCurrency: (v: number) => string;
  onConfirmPayment?: (data: { receipt_url?: string; receipt_name?: string; notes?: string }) => void;
  onConfirmWithoutReceipt?: () => void;
  onUpdateReceipt?: (data: { receipt_url?: string; receipt_name?: string; notes?: string }) => void;
  onRemoveReceipt?: () => void;
  onUnmarkPayment?: () => void;
  isVendorMode?: boolean;
}

export function TerrenoReceiptModal({
  isOpen,
  onClose,
  mode: initialMode,
  installment,
  receiptData,
  formatCurrency,
  onConfirmPayment,
  onConfirmWithoutReceipt,
  onUpdateReceipt,
  onRemoveReceipt,
  onUnmarkPayment,
  isVendorMode = false
}: TerrenoReceiptModalProps) {
  const [mode, setMode] = useState<'view' | 'pay' | 'attach'>(initialMode);
  const [selectedFile, setSelectedFile] = useState<{ dataUrl: string; name: string; size: number } | null>(null);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomImage, setZoomImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(initialMode);
    setSelectedFile(null);
    setNotes(receiptData?.notes || '');
    setZoomImage(false);
  }, [initialMode, receiptData, isOpen]);

  if (!isOpen) return null;

  const currentReceiptUrl = selectedFile?.dataUrl || receiptData?.receipt_url;
  const currentReceiptName = selectedFile?.name || receiptData?.receipt_name || 'comprovante.jpg';
  const isPdf = currentReceiptUrl?.startsWith('data:application/pdf') || currentReceiptUrl?.toLowerCase().endsWith('.pdf');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const result = await readFileAsDataUrl(file);
      setSelectedFile(result);
      toast.success(`Comprovante "${file.name}" carregado com sucesso!`);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao processar arquivo: ' + (err.message || 'Arquivo inválido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const result = await readFileAsDataUrl(file);
      setSelectedFile(result);
      toast.success(`Comprovante "${file.name}" anexado!`);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao carregar arquivo arrastado.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSavePaymentWithReceipt = () => {
    if (onConfirmPayment) {
      onConfirmPayment({
        receipt_url: selectedFile?.dataUrl || undefined,
        receipt_name: selectedFile?.name || undefined,
        notes: notes.trim() || undefined
      });
    }
    onClose();
  };

  const handleSaveUpdateReceipt = () => {
    if (onUpdateReceipt && selectedFile) {
      onUpdateReceipt({
        receipt_url: selectedFile.dataUrl,
        receipt_name: selectedFile.name,
        notes: notes.trim() || undefined
      });
      toast.success('Comprovante atualizado com sucesso!');
      setMode('view');
    }
  };

  const handleDownload = () => {
    if (!currentReceiptUrl) return;
    downloadReceiptFile(currentReceiptUrl, currentReceiptName);
    toast.success('Download do comprovante iniciado!');
  };

  const handleShareWhatsApp = () => {
    const title = `${installment.monthName} ${installment.year}`;
    const value = formatCurrency(installment.value);
    const shareText = getReceiptWhatsAppShareText(title, value, installment.auditId, receiptData?.notes || notes);
    window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
  };

  const handleCopyLink = async () => {
    try {
      if (currentReceiptUrl && !currentReceiptUrl.startsWith('data:')) {
        await navigator.clipboard.writeText(currentReceiptUrl);
        toast.success('Link do comprovante copiado!');
      } else {
        const text = `Comprovante Parcela Terreno (${installment.monthName} ${installment.year}) - Valor: ${formatCurrency(installment.value)} - ID: ${installment.auditId}`;
        await navigator.clipboard.writeText(text);
        toast.success('Informações do comprovante copiadas!');
      }
    } catch {
      toast.error('Não foi possível copiar link.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              {mode === 'view' ? <FileText size={20} /> : <Upload size={20} />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {mode === 'view' 
                  ? 'Comprovante de Pagamento' 
                  : mode === 'attach' 
                    ? 'Anexar Comprovante à Parcela' 
                    : 'Confirmar Pagamento da Parcela'}
              </h3>
              <p className="text-xs text-slate-400">
                <span className="capitalize font-semibold text-slate-200">{installment.monthName} {installment.year}</span>
                {' • '}
                <span className="font-mono text-emerald-400 font-bold">{formatCurrency(installment.value)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => copyAuditIdToClipboard(installment.auditId, e)}
              className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2 py-1 rounded-lg transition-all"
              title="Copiar código de auditoria"
            >
              {installment.auditId}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/60 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Card Resumo da Parcela */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 p-3.5 bg-slate-950/40 rounded-2xl border border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Vencimento</span>
              <span className="font-medium text-slate-200">
                25/{String(installment.date.getMonth() + 1).padStart(2, '0')}/{installment.year}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Valor da Parcela</span>
              <span className="font-bold text-emerald-400 font-mono">{formatCurrency(installment.value)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Identificador</span>
              <span className="font-mono text-blue-400">{installment.auditId}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Status</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                <CheckCircle2 size={12} />
                {mode === 'pay' ? 'Em pagamento' : 'Liquidada'}
              </span>
            </div>
          </div>

          {/* MODO VISUALIZAÇÃO DE COMPROVANTE */}
          {mode === 'view' && (
            <div className="space-y-4">
              {currentReceiptUrl ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden group">
                    {isPdf ? (
                      <div className="p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[220px]">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/5">
                          <FileText size={32} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200 text-sm">{currentReceiptName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Documento em formato PDF</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-semibold transition-all active:scale-95"
                        >
                          <Download size={14} />
                          Baixar / Abrir Documento PDF
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="max-h-[380px] flex items-center justify-center bg-black/40 overflow-hidden">
                          <img
                            src={currentReceiptUrl}
                            alt="Comprovante de pagamento"
                            className={`w-full object-contain max-h-[380px] rounded-xl transition-all duration-300 ${zoomImage ? 'scale-125 cursor-zoom-out' : 'cursor-zoom-in'}`}
                            onClick={() => setZoomImage(!zoomImage)}
                          />
                        </div>
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setZoomImage(!zoomImage)}
                            className="p-2 rounded-xl bg-slate-900/80 backdrop-blur-md text-white hover:bg-slate-800 border border-slate-700 shadow-md text-xs"
                            title="Alternar zoom"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={handleDownload}
                            className="p-2 rounded-xl bg-slate-900/80 backdrop-blur-md text-white hover:bg-slate-800 border border-slate-700 shadow-md text-xs"
                            title="Baixar comprovante"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Informações complementares */}
                  {(receiptData?.notes || receiptData?.paid_at) && (
                    <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-xs space-y-1">
                      {receiptData.notes && (
                        <p className="text-slate-300">
                          <strong className="text-slate-400">Observação:</strong> {receiptData.notes}
                        </p>
                      )}
                      {receiptData.paid_at && (
                        <p className="text-slate-500 text-[11px]">
                          Registrado em: {new Date(receiptData.paid_at).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Barra de Ações de Compartilhamento e Download */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-white text-xs font-semibold transition-all shadow-sm active:scale-95"
                    >
                      <Download size={15} className="text-emerald-400" />
                      <span>Baixar Arquivo</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-all active:scale-95"
                    >
                      <Share2 size={15} className="text-emerald-400" />
                      <span>Enviar no WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-300 text-xs font-semibold transition-all active:scale-95"
                    >
                      <Copy size={15} className="text-blue-400" />
                      <span>Copiar Dados</span>
                    </button>
                  </div>

                  {/* Ações Administrativas (somente se não estiver em modo vendedor) */}
                  {!isVendorMode && (
                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setMode('attach')}
                        className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1.5 font-semibold py-1.5 px-3 rounded-xl hover:bg-blue-500/10 transition-all"
                      >
                        <RefreshCw size={13} />
                        Substituir Comprovante
                      </button>

                      <div className="flex items-center gap-2">
                        {onRemoveReceipt && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Deseja remover apenas o comprovante anexado, mantendo a parcela como paga?')) {
                                onRemoveReceipt();
                                onClose();
                              }
                            }}
                            className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 font-semibold py-1.5 px-3 rounded-xl hover:bg-amber-500/10 transition-all"
                          >
                            <Trash2 size={13} />
                            Remover Anexo
                          </button>
                        )}
                        {onUnmarkPayment && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Deseja desmarcar o pagamento da parcela ${installment.monthName} ${installment.year}?`)) {
                                onUnmarkPayment();
                                onClose();
                              }
                            }}
                            className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1 font-semibold py-1.5 px-3 rounded-xl hover:bg-red-500/10 transition-all"
                          >
                            Desmarcar Parcela
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Caso a parcela esteja paga mas ainda não tenha comprovante */
                <div className="text-center py-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <AlertCircle size={28} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">Nenhum comprovante anexado ainda</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                      Esta parcela foi marcada como paga, mas ainda não possui o arquivo do comprovante anexado.
                    </p>
                  </div>

                  {!isVendorMode && (
                    <button
                      type="button"
                      onClick={() => setMode('attach')}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md active:scale-95"
                    >
                      <Upload size={14} />
                      Anexar Comprovante Agora
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MODO UPLOAD / CONFIRMAÇÃO DE PAGAMENTO */}
          {(mode === 'pay' || mode === 'attach') && (
            <div className="space-y-4">
              {/* Dropzone de upload */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-500/10' 
                    : selectedFile 
                      ? 'border-emerald-500/50 bg-emerald-500/5' 
                      : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                />

                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <span className="text-xs font-medium">Otimizando e preparando comprovante...</span>
                  </div>
                ) : selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      {isPdf ? <FileText size={24} /> : <CheckCircle2 size={24} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400">
                        Tamanho otimizado: {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <span className="text-[11px] text-blue-400 hover:underline mt-1 font-medium">
                      Clique para trocar de arquivo
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
                      <Upload size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        Clique para anexar ou arraste o comprovante
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Formatos aceitos: Imagens (JPG, PNG, WEBP) ou documento PDF
                      </p>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 mt-1">
                      Compressão automática ultrarrápida
                    </span>
                  </div>
                )}
              </div>

              {/* Preview rápido se for imagem selecionada */}
              {selectedFile && !isPdf && (
                <div className="relative rounded-xl border border-slate-800 overflow-hidden bg-black/30 max-h-48 flex items-center justify-center">
                  <img
                    src={selectedFile.dataUrl}
                    alt="Preview"
                    className="max-h-48 object-contain rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs transition-colors"
                    title="Remover anexo selecionado"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {/* Observação opcional */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Observação do Pagamento (Opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Pago via Pix por Mccley, transferido pelo Nubank..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-600 text-xs focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none"
                />
              </div>

              {/* Botões de Ação do Modo Pay/Attach */}
              <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>

                {mode === 'pay' && onConfirmWithoutReceipt && (
                  <button
                    type="button"
                    onClick={() => {
                      onConfirmWithoutReceipt();
                      onClose();
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all active:scale-95"
                  >
                    Pagar sem Comprovante
                  </button>
                )}

                {mode === 'attach' ? (
                  <button
                    type="button"
                    disabled={!selectedFile || isProcessing}
                    onClick={handleSaveUpdateReceipt}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Upload size={14} />
                    Salvar Comprovante
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleSavePaymentWithReceipt}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
                  >
                    <CheckCircle2 size={14} />
                    {selectedFile ? 'Confirmar com Comprovante' : 'Confirmar Pagamento'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
