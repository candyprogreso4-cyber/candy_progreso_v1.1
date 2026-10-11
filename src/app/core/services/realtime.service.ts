import { Injectable, inject, OnDestroy } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseClientService } from './supabase-client.service';
import { ToastService } from './toast.service';

export type RealtimeChangeCallback = (payload: {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  newRecord: any;
  oldRecord: any;
}) => void;

@Injectable({
  providedIn: 'root',
})
export class RealtimeService implements OnDestroy {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly toast = inject(ToastService);

  private activeChannel: RealtimeChannel | null = null;
  private readonly listeners = new Set<RealtimeChangeCallback>();

  initRealtime(): void {
    if (this.activeChannel) return;

    try {
      this.activeChannel = this.supabase
        .channel('candy-pos-global-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => this.dispatchChange('orders', payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tables' },
          (payload) => this.dispatchChange('tables', payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'payments' },
          (payload) => this.dispatchChange('payments', payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cash_registers' },
          (payload) => this.dispatchChange('cash_registers', payload)
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Supabase Realtime: conectado al canal global.');
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('Supabase Realtime: error en el canal.', err);
          }
        });
    } catch (err) {
      console.warn('Error inicializando Realtime:', err);
    }
  }

  private dispatchChange(table: string, payload: any): void {
    const change = {
      table,
      eventType: payload.eventType,
      newRecord: payload.new,
      oldRecord: payload.old,
    };

    this.listeners.forEach((listener) => {
      try {
        listener(change);
      } catch (e) {
        console.error('Error en listener de Realtime:', e);
      }
    });
  }

  subscribe(callback: RealtimeChangeCallback): () => void {
    this.initRealtime();
    this.listeners.add(callback);

    // Retornar función de limpieza
    return () => {
      this.listeners.delete(callback);
    };
  }

  ngOnDestroy(): void {
    if (this.activeChannel) {
      this.supabase.removeChannel(this.activeChannel);
      this.activeChannel = null;
    }
    this.listeners.clear();
  }
}
