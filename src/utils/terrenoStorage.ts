import { pb } from '../pocketbaseClient';
import type { TerrenoInstallmentRecord } from '../types';

const STORAGE_KEY = 'casadolago_terreno_receipts';

/**
 * Retorna todos os comprovantes e metadados de parcelas armazenados localmente (cache resiliente)
 */
export function getStoredTerrenoReceipts(): Record<string, Partial<TerrenoInstallmentRecord>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Erro ao carregar recibos locais do terreno:', err);
    return {};
  }
}

/**
 * Salva ou atualiza os dados/comprovante de uma parcela no cache local
 */
export function saveStoredTerrenoReceipt(
  monthId: string,
  data: Partial<TerrenoInstallmentRecord>
): void {
  try {
    const current = getStoredTerrenoReceipts();
    current[monthId] = {
      ...(current[monthId] || {}),
      ...data,
      month_id: monthId,
      paid_at: data.paid_at || current[monthId]?.paid_at || new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Erro ao salvar recibo do terreno no cache local:', err);
  }
}

/**
 * Remove o comprovante/registro de uma parcela do cache local
 */
export function deleteStoredTerrenoReceipt(monthId: string): void {
  try {
    const current = getStoredTerrenoReceipts();
    delete current[monthId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Erro ao remover recibo do terreno do cache local:', err);
  }
}

/**
 * Comprime uma imagem de comprovante no navegador antes do upload para otimizar velocidade,
 * economizar banda móvel e garantir carregamento instantâneo.
 */
export async function compressReceiptImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<{ dataUrl: string; name: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao processar imagem para compressão.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback para imagem original se canvas não estiver disponível
          resolve({
            dataUrl: e.target?.result as string,
            name: file.name,
            size: file.size
          });
          return;
        }

        // Fundo branco caso haja transparência PNG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Calcula tamanho aproximado em bytes da string Base64
        const approxSize = Math.round((dataUrl.length * 3) / 4);

        resolve({
          dataUrl,
          name: file.name.replace(/\.[^/.]+$/, "") + '.jpg',
          size: approxSize
        });
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Converte qualquer arquivo (PDF ou imagem) para DataURL
 */
export async function readFileAsDataUrl(
  file: File
): Promise<{ dataUrl: string; name: string; size: number }> {
  if (file.type.startsWith('image/')) {
    return compressReceiptImage(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.onload = () => {
      resolve({
        dataUrl: reader.result as string,
        name: file.name,
        size: file.size
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Garante defensivamente que a coleção 'terreno_installments' no PocketBase
 * contenha os campos necessários para armazenar os comprovantes.
 * Executado silenciosamente se o usuário logado tiver permissões administrativas.
 */
export async function ensureTerrenoInstallmentsSchema(): Promise<void> {
  try {
    if (!pb.authStore.isValid) return;

    // Apenas superusuários ou admins podem alterar esquemas
    const col = await pb.collections.getOne('terreno_installments').catch(() => null);
    if (!col) return;

    const existingFields = (col.fields || (col as any).schema || []).map((f: any) => f.name);
    const newFields = [...(col.fields || [])];
    let needsUpdate = false;

    if (!existingFields.includes('receipt_url')) {
      newFields.push({ name: 'receipt_url', type: 'text', required: false });
      needsUpdate = true;
    }
    if (!existingFields.includes('receipt_name')) {
      newFields.push({ name: 'receipt_name', type: 'text', required: false });
      needsUpdate = true;
    }
    if (!existingFields.includes('notes')) {
      newFields.push({ name: 'notes', type: 'text', required: false });
      needsUpdate = true;
    }
    if (!existingFields.includes('paid_at')) {
      newFields.push({ name: 'paid_at', type: 'text', required: false });
      needsUpdate = true;
    }

    if (needsUpdate) {
      await pb.collections.update('terreno_installments', { fields: newFields });
      console.log('✓ PocketBase: coleção terreno_installments atualizada com campos de comprovante');
    }
  } catch (err) {
    // Ignora silenciosamente se usuário não tiver permissão de gerência de coleção
  }
}

/**
 * Dispara o download de um comprovante no navegador do usuário
 */
export function downloadReceiptFile(dataUrl: string, filename: string): void {
  try {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename || 'comprovante-terreno.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Erro ao baixar comprovante:', err);
    window.open(dataUrl, '_blank');
  }
}

/**
 * Gera a URL amigável e segura para o acesso exclusivo do vendedor
 */
export function getVendorShareUrl(): string {
  const origin = window.location.origin;
  const path = window.location.pathname.replace(/\/$/, '');
  return `${origin}${path}?vendedor=true`;
}

/**
 * Monta o texto padrão formatado para envio no WhatsApp do vendedor
 */
export function getVendorWhatsAppShareText(vendorUrl: string): string {
  return encodeURIComponent(
    `Olá! Segue o link de acesso exclusivo para você acompanhar em tempo real as parcelas pagas, saldo devedor e todos os comprovantes anexados do financiamento do terreno da Casa do Lago:\n\n${vendorUrl}\n\n*Acompanhamento Transparente e Atualizado*`
  );
}

/**
 * Monta o texto para compartilhar um comprovante individual específico via WhatsApp
 */
export function getReceiptWhatsAppShareText(
  installmentTitle: string,
  valueFormatted: string,
  auditId: string,
  notes?: string
): string {
  const obsText = notes ? `\n📝 Observação: ${notes}` : '';
  const vendorUrl = getVendorShareUrl();
  return encodeURIComponent(
    `✅ *Comprovante de Pagamento — Terreno Casa do Lago*\n\n` +
    `📌 Parcela: ${installmentTitle}\n` +
    `💰 Valor: ${valueFormatted}\n` +
    `🔖 Código de Auditoria: ${auditId}` +
    obsText +
    `\n\n🔗 Acompanhe o saldo devedor e todos os comprovantes no portal:\n${vendorUrl}`
  );
}
