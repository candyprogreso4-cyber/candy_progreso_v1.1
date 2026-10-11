import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { ToastService } from './toast.service';
import { Order, OrderItemTopping, CartItem } from '../models/pos.types';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly activeOrders = signal<Order[]>([]);
  readonly pendingPaymentOrders = signal<Order[]>([]);
  readonly selectedOrder = signal<Order | null>(null);
  readonly isLoading = signal(false);
  readonly activeOrdersError = signal('');
  readonly employeeOrdersError = signal('');

  async loadActiveOrders(): Promise<Order[]> {
    this.isLoading.set(true);
    this.activeOrdersError.set('');
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select(`
          *,
          table:tables(*),
          employee:employees(id, full_name),
          items:order_items(
            *,
            toppings:order_item_toppings(*)
          )
        `)
        .in('status', ['pending', 'preparing', 'ready', 'delivered'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const list: Order[] = (data || []).map((o: any) => this.mapOrder(o));
      this.activeOrders.set(list);
      return list;
    } catch (err: unknown) {
      console.warn('Error al cargar pedidos activos:', err);
      this.activeOrdersError.set(
        err instanceof Error ? err.message : 'No se pudieron cargar los pedidos.'
      );
      return this.activeOrders();
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadPendingPaymentOrders(): Promise<Order[]> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select(`
          *,
          table:tables(*),
          employee:employees(id, full_name),
          items:order_items(
            *,
            toppings:order_item_toppings(*)
          )
        `)
        .eq('status', 'completed')
        .eq('payment_status', 'pending')
        .order('completed_at', { ascending: false });

      if (error) throw error;

      const list: Order[] = (data || []).map((o: any) => this.mapOrder(o));
      this.pendingPaymentOrders.set(list);
      return list;
    } catch (err: unknown) {
      console.warn('Error al cargar pendientes de cobro:', err);
      return this.pendingPaymentOrders();
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadEmployeeOrders(): Promise<Order[]> {
    this.employeeOrdersError.set('');
    try {
      const { data, error } = await this.supabase.rpc('get_employee_orders', {
        p_session_token: null,
      });
      if (error) throw error;

      return (data || []).map((o: any) =>
        this.mapOrder({
          ...o,
          table: o.table_info,
          employee: o.employee_info,
        })
      );
    } catch (err) {
      console.warn('Error al cargar pedidos del empleado:', err);
      this.employeeOrdersError.set(
        err instanceof Error ? err.message : 'No se pudieron cargar tus pedidos.'
      );
      return [];
    }
  }

  async createOrder(
    tableId: string | null,
    notes: string,
    cartItems: CartItem[]
  ): Promise<{ success: boolean; orderNumber?: number }> {
    try {
      if (cartItems.length === 0) {
        this.toast.warning('El carrito está vacío. Agrega productos.');
        return { success: false };
      }

      // Preparar payload para la RPC segura
      const itemsPayload = cartItems.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        size: item.size || null,
        flavor: item.flavor || null,
        notes: item.notes || null,
        topping_ids: item.toppings.map((t) => t.id),
      }));

      const { data, error } = await this.supabase.rpc('create_employee_order', {
        p_session_token: null,
        p_table_id: tableId,
        p_notes: notes || '',
        p_items: itemsPayload,
      });

      if (error) {
        const msg = error.message.includes('no está activo')
          ? 'Uno de los productos seleccionados ya no está disponible.'
          : error.message.includes('23505')
          ? 'Este pedido ya fue registrado. Actualiza la pantalla e inténtalo nuevamente.'
          : error.message;
        this.toast.error(msg, 'Error al crear pedido');
        return { success: false };
      }

      const orderNum = data?.order_number;
      this.toast.success(`Pedido #${String(orderNum || '').padStart(3, '0')} enviado a preparación con éxito!`, '¡Comanda Creada!');
      await this.loadActiveOrders();
      return { success: true, orderNumber: orderNum };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al crear comanda.';
      this.toast.error(msg);
      return { success: false };
    }
  }

  async markOrderCompleted(orderId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('mark_order_completed', {
        p_order_id: orderId,
      });

      if (error) throw error;

      this.toast.success('Pedido marcado como FINALIZADO. Pasó a pendientes de cobro.');
      await Promise.all([
        this.loadActiveOrders(),
        this.loadPendingPaymentOrders(),
      ]);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al finalizar pedido.';
      this.toast.error(msg);
      return false;
    }
  }

  async markOrderReady(orderId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('mark_order_ready', {
        p_order_id: orderId,
      });
      if (error) throw error;

      this.toast.success('Pedido marcado como listo para entregar.');
      await this.loadActiveOrders();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al marcar el pedido como listo.';
      this.toast.error(msg);
      return false;
    }
  }

  async markOrderDelivered(orderId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('mark_employee_order_delivered', {
        p_session_token: null,
        p_order_id: orderId,
      });

      if (error) throw error;

      this.toast.success('Pedido marcado como ENTREGADO en mesa.');
      await this.loadActiveOrders();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar comanda.';
      this.toast.error(msg);
      return false;
    }
  }

  private mapOrder(o: any): Order {
    return {
      id: o.id,
      order_number: o.order_number,
      table_id: o.table_id,
      employee_id: o.employee_id,
      status: o.status,
      payment_status: o.payment_status,
      subtotal: Number(o.subtotal),
      discount: Number(o.discount),
      total: Number(o.total),
      notes: o.notes,
      created_at: o.created_at,
      updated_at: o.updated_at,
      completed_at: o.completed_at,
      delivered_at: o.delivered_at,
      cancelled_at: o.cancelled_at,
      table: o.table,
      employee: o.employee,
      items: (o.items || []).map((it: any) => ({
        id: it.id,
        order_id: it.order_id,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: Number(it.unit_price),
        subtotal: Number(it.subtotal),
        size: it.size,
        flavor: it.flavor,
        notes: it.notes,
        created_at: it.created_at,
        toppings: this.mapOrderItemToppings(it),
      })),
    };
  }

  private mapOrderItemToppings(item: Record<string, any>): OrderItemTopping[] {
    const rawToppings = item['toppings'] ?? item['order_item_toppings'] ?? [];
    if (!Array.isArray(rawToppings)) {
      console.warn('La respuesta del pedido no contiene una lista de toppings válida:', item['id']);
      return [];
    }

    return rawToppings.map((topping: any): OrderItemTopping => ({
      id: topping.id ?? topping.topping_id,
      order_item_id: topping.order_item_id ?? item['id'],
      topping_id: topping.topping_id ?? topping.id,
      topping_name: topping.topping_name ?? topping.name ?? topping.topping?.name ?? 'Topping',
      price: Number(topping.price ?? 0),
    }));
  }
}
