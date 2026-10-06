import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Eye, 
  MessageCircle,
  FileCheck2
} from 'lucide-react';
import { toast } from 'sonner';
import { getVendorShareUrl, getVendorWhatsAppShareText } from '../utils/terrenoStorage';

interface TerrenoVendorShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TerrenoVendorShareModal({ isOpen, onClose }: TerrenoVendorShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const vendorUrl = getVendorShareUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(vendorUrl);
      setCopied(true);
      toast.success('Link do vendedor copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Erro ao copiar link.');
    }
  };

  const handleWhatsApp = () => {
    const text = getVendorWhatsAppShareText(vendorUrl);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleOpenPreview = () => {
    window.open(vendorUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Share2 size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Acesso do Vendedor
              </h3>
              <p className="text-xs text-slate-400">
                Link direto para acompanhamento das parcelas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Caixa de Explicação de Segurança */}
          <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
            <ShieldCheck size={22} className="text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h4 className="font-semibold text-blue-200">Privacidade Garantida</h4>
              <p className="text-slate-300 leading-relaxed">
                O vendedor terá acesso <strong>apenas às parcelas do terreno, saldo devedor e comprovantes anexados</strong>.
              </p>
              <p className="text-slate-400 leading-relaxed">
                O banner com empréstimos de Zaira, juros e os demais gastos da obra permanecem <strong>100% confidenciais e ocultos</strong>.
              </p>
            </div>
          </div>

          {/* Campo com Link de Acesso */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Link de Acesso Direto
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={vendorUrl}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200 font-mono text-xs outline-none select-all focus:border-blue-500/50"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-sm ${
                  copied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* O que o vendedor pode fazer */}
          <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-2 text-xs">
            <span className="font-semibold text-slate-300 block text-[11px] uppercase tracking-wider">
              O que o vendedor visualiza no portal:
            </span>
            <ul className="space-y-1.5 text-slate-400">
              <li className="flex items-center gap-2">
                <FileCheck2 size={13} className="text-emerald-400 shrink-0" />
                <span>Saldo devedor restante atualizado em tempo real</span>
              </li>
              <li className="flex items-center gap-2">
                <FileCheck2 size={13} className="text-emerald-400 shrink-0" />
                <span>Lista completa de parcelas pagas e próximos vencimentos</span>
              </li>
              <li className="flex items-center gap-2">
                <FileCheck2 size={13} className="text-emerald-400 shrink-0" />
                <span>Visualização e download de todos os comprovantes anexados</span>
              </li>
            </ul>
          </div>

          {/* Botões de Ação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <MessageCircle size={16} />
              <span>Enviar no WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPreview}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200 text-xs font-semibold transition-all active:scale-95"
            >
              <Eye size={15} className="text-blue-400" />
              <span>Testar Visão do Vendedor</span>
              <ExternalLink size={12} className="opacity-60" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
