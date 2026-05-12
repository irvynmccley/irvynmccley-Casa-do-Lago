import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';

export type SyncOperation = {
  type: string;
  payload: any;
  id?: string;
  timestamp: number;
};

export function useOfflineSync(fetchAllData: () => Promise<void>) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineData();
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      toast('Você está offline. Alterações serão salvas localmente e sincronizadas quando houver conexão.', { icon: '📶' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check just in case we started offline and have queued items
    if (navigator.onLine) {
       syncOfflineData();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchAllData]);

  const syncOfflineData = async () => {
    const queueJson = localStorage.getItem('offline_sync_queue');
    if (!queueJson) return;
    
    try {
      const queue: SyncOperation[] = JSON.parse(queueJson);
      if (queue.length === 0) return;

      setIsSyncing(true);
      const remainingQueue: SyncOperation[] = [];
      let successCount = 0;
      let syncError = false;

      for (const op of queue) {
        try {
          if (op.type === 'ADD_EXPENSE') {
            const { error } = await supabase.from('expenses').insert(op.payload);
            if (error) throw error;
          } else if (op.type === 'EDIT_EXPENSE') {
            const { error } = await supabase.from('expenses').update(op.payload).eq('id', op.id);
            if (error) throw error;
          } else if (op.type === 'DELETE_EXPENSE') {
            const { error } = await supabase.from('expenses').delete().eq('id', op.id);
            if (error) throw error;
          } else if (op.type === 'ADD_INCOME') {
            const { error } = await supabase.from('incomes').insert(op.payload);
            if (error) throw error;
          } else if (op.type === 'EDIT_INCOME') {
            const { error } = await supabase.from('incomes').update(op.payload).eq('id', op.id);
            if (error) throw error;
          } else if (op.type === 'DELETE_INCOME') {
            const { error } = await supabase.from('incomes').delete().eq('id', op.id);
            if (error) throw error;
          } else if (op.type === 'ADD_PAYMENT') {
            const { error } = await supabase.from('payments').insert(op.payload);
            if (error) throw error;
          } else if (op.type === 'DELETE_PAYMENT') {
            const { error } = await supabase.from('payments').delete().eq('id', op.id);
            if (error) throw error;
          } else if (op.type === 'TOGGLE_TERRENO') {
            if (op.payload.action === 'delete') {
               const { error } = await supabase.from('terreno_installments').delete().eq('id', op.id);
               if (error) throw error;
            } else {
               const { error } = await supabase.from('terreno_installments').upsert({ id: op.id });
               if (error) throw error;
            }
          }
          successCount++;
        } catch (e: any) {
          console.error(`Failed to sync operation ${op.type}:`, e);
          if (e.message && (e.message.includes('FetchError') || e.message.includes('Failed to fetch') || e.message.includes('network'))) {
             remainingQueue.push(op);
             syncError = true;
          } else {
            // Drop it and log it
            console.error("Dropping failed operation due to bad request or permission:", op);
          }
        }
      }

      if (remainingQueue.length > 0) {
        localStorage.setItem('offline_sync_queue', JSON.stringify(remainingQueue));
      } else {
        localStorage.removeItem('offline_sync_queue');
      }

      if (successCount > 0) {
        await fetchAllData();
        toast.success(`Sincronizados ${successCount} registros pendentes!`);
      }
      
      if (syncError) {
         toast.error("Alguns registros não puderam ser sincronizados (offline) e permanecem na fila.");
      }
    } catch (e) {
      console.error('Error reading offline queue', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveToOfflineQueue = (type: string, payload: any, id?: string) => {
    try {
      const queueJson = localStorage.getItem('offline_sync_queue');
      const queue: SyncOperation[] = queueJson ? JSON.parse(queueJson) : [];
      queue.push({ type, payload, id, timestamp: Date.now() });
      localStorage.setItem('offline_sync_queue', JSON.stringify(queue));
    } catch (e) {
      console.error('Error saving to offline queue', e);
    }
  };

  return { isOffline, isSyncing, saveToOfflineQueue, syncOfflineData };
}
