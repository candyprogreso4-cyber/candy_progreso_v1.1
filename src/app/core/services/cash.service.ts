import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { ToastService } from './toast.service';
import { CashRegister, CashMovement } from '../models/pos.types';

@Injectable({
  providedIn: 'root',
})
export class CashService {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly toast = inject(ToastService);

  readonly currentRegister = signal<CashRegister | null>(null);
  readonly movements = signal<CashMovement[]>([]);
  readonly isLoading = signal(false);

  async loadCurrentRegister(): Promise<CashRegister | null> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('cash_registers')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const reg: CashRegister = {
          id: data.id,
          opened_by: data.opened_by,
          opened_at: data.opened_at,
          opening_amount: Number(data.opening_amount),
          closed_by: data.closed_by,
          closed_at: data.closed_at,
          closing_amount: data.closing_amount ? Number(data.closing_amount) : null,
          expected_amount: data.expected_amount ? Number(data.expected_amount) : null,
          difference: data.difference ? Number(data.difference) : null,
          status: 'open',
        };
        this.currentRegister.set(reg);
        await this.loadMovements(reg.id);
        return reg;
      } else {
        this.currentRegister.set(null);
        this.movements.set([]);
        return null;
      }
    } catch (err) {
      console.warn('Error al cargar caja activa:', err);
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMovements(registerId: string): Promise<CashMovement[]> {
    try {
      const { data, error } = await this.supabase
        .from('cash_movements')
        .select('*')
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const list: CashMovement[] = (data || []).map((m: any) => ({
        id: m.id,
        cash_register_id: m.cash_register_id,
        amount: Number(m.amount),
        type: m.type,
        description: m.description,
        created_by: m.created_by,
        created_at: m.created_at,
      }));

      this.movements.set(list);
      return list;
    } catch (err) {
      console.warn('Error al cargar movimientos de caja:', err);
      return [];
    }
  }

  async openRegister(amount: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('open_cash_register', {
        p_opening_amount: amount,
      });

      if (error) throw error;

      this.toast.success(`Caja abierta con base de $${amount.toLocaleString('es-CO')}.`);
      await this.loadCurrentRegister();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al abrir caja.';
      this.toast.error(msg);
      return false;
    }
  }

  async closeRegister(
    registerId: string,
    closingAmount: number,
    notes: string = ''
  ): Promise<{ success: boolean; difference?: number; pendingOrders?: number }> {
    try {
      const { data, error } = await this.supabase.rpc('close_cash_register', {
        p_register_id: registerId,
        p_closing_amount: closingAmount,
        p_notes: notes,
      });

      if (error) throw error;

      this.currentRegister.set(null);
      this.movements.set([]);
      this.toast.success('Jornada finalizada y caja cerrada exitosamente.');
      return {
        success: true,
        difference: data?.difference,
        pendingOrders: data?.pending_orders_warning,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cerrar caja.';
      this.toast.error(msg);
      return { success: false };
    }
  }

  async registerMovement(
    type: 'income' | 'expense' | 'adjustment',
    amount: number,
    description: string
  ): Promise<boolean> {
    const reg = this.currentRegister();
    if (!reg) {
      this.toast.error('No hay una caja abierta actualmente.');
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('cash_movements')
        .insert([{
          cash_register_id: reg.id,
          amount: amount,
          type: type,
          description: description,
        }]);

      if (error) throw error;

      this.toast.success(`Movimiento de ${type.toUpperCase()} registrado.`);
      await this.loadMovements(reg.id);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar movimiento.';
      this.toast.error(msg);
      return false;
    }
  }
}
