import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { ToastService } from './toast.service';
import { PaymentMethod, Payment } from '../models/pos.types';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly toast = inject(ToastService);

  async registerPayment(
    orderId: string,
    method: PaymentMethod,
    amount: number,
    receivedAmount: number = 0,
    changeAmount: number = 0
  ): Promise<boolean> {
    try {
      if (method === 'cash' && receivedAmount < amount) {
        this.toast.error('El efectivo recibido no puede ser inferior al total a pagar.');
        return false;
      }

      const { data, error } = await this.supabase.rpc('register_order_payment', {
        p_order_id: orderId,
        p_method: method,
        p_received: receivedAmount || amount,
        p_change: changeAmount || 0,
      });

      if (error) {
        const msg = error.message.includes('cuenta con un pago')
          ? 'Este pedido ya fue pagado previamente.'
          : error.message;
        this.toast.error(msg, 'No se pudo registrar el pago');
        return false;
      }

      this.toast.success(
        `Pago de $${amount.toLocaleString('es-CO')} registrado exitosamente por ${method.toUpperCase()}.`,
        '¡Cobro Realizado!'
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al procesar pago.';
      this.toast.error(msg);
      return false;
    }
  }

  async getRecentPayments(limit = 50): Promise<Payment[]> {
    try {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        order_id: p.order_id,
        amount: Number(p.amount),
        payment_method: p.payment_method as PaymentMethod,
        received_amount: Number(p.received_amount),
        change_amount: Number(p.change_amount),
        registered_by: p.registered_by,
        created_at: p.created_at,
      }));
    } catch (err) {
      console.warn('Error al cargar pagos recientes:', err);
      return [];
    }
  }
}
