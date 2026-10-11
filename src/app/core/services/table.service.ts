import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { ToastService } from './toast.service';
import { DiningTable, TableStatus } from '../models/pos.types';

@Injectable({
  providedIn: 'root',
})
export class TableService {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly toast = inject(ToastService);

  readonly tables = signal<DiningTable[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal('');

  async loadTables(): Promise<DiningTable[]> {
    this.isLoading.set(true);
    this.loadError.set('');
    try {
      const { data, error } = await this.supabase.rpc('get_employee_tables', {
        p_session_token: null,
      });

      if (error) throw error;

      const list: DiningTable[] = (data ?? []).map((t: {
        id: string;
        table_number: number;
        status: string;
        created_at: string;
      }) => ({
        id: t.id,
        table_number: t.table_number,
        status: t.status as TableStatus,
        created_at: t.created_at,
      }));

      this.tables.set(list);
      return list;
    } catch (err: unknown) {
      console.warn('Error al cargar mesas:', err);
      this.tables.set([]);
      this.loadError.set(err instanceof Error ? err.message : 'No se pudieron cargar las mesas.');
      return [];
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateTableStatus(tableId: string, status: TableStatus): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('tables')
        .update({ status })
        .eq('id', tableId);

      if (error) throw error;

      this.tables.update((current) =>
        current.map((t) => (t.id === tableId ? { ...t, status } : t))
      );
      return true;
    } catch (err) {
      console.error('Error actualizando estado de mesa:', err);
      return false;
    }
  }
}
