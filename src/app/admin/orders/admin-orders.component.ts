import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../core/services/order.service';
import { Order } from '../../core/models/pos.types';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, CurrencyCopPipe],
  template: `
    <div class="space-y-6">
      
      <!-- Top Title and Stats -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-primary">Centro de Pedidos Activos</h1>
          <p class="text-xs text-on-surface-variant mt-0.5">
            Pedidos en vivo · actualización automática cada 20 segundos
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1.5 rounded-xl bg-purple-50 text-primary-container text-xs font-bold border border-purple-200">
            {{ orderService.activeOrders().length }} pedidos activos
          </span>
          <button
            type="button"
            (click)="refresh()"
            class="px-3 py-1.5 rounded-xl bg-white hover:bg-surface-container text-primary text-xs font-bold border border-outline-variant/40 flex items-center gap-1 transition-all"
          >
            <span class="material-symbols-outlined text-sm">refresh</span>
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      @if (orderService.activeOrdersError()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          <p class="font-semibold">No se pudieron cargar los pedidos.</p>
          <p class="mt-1">{{ orderService.activeOrdersError() }}</p>
          <button
            type="button"
            (click)="refresh()"
            class="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary border border-rose-200"
          >
            Reintentar
          </button>
        </div>
      }

      <!-- Orders Matrix Grid (Responsive Multi-column, minimum card width 320px) -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        @for (order of orderService.activeOrders(); track order.id) {
          <div
            class="bg-white rounded-2xl border border-outline-variant/40 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative"
            [ngClass]="{
              'border-l-4 border-l-amber-500': order.status === 'preparing' || order.status === 'pending',
              'border-l-4 border-l-emerald-500 ring-2 ring-emerald-500/20': order.status === 'ready',
              'border-l-4 border-l-blue-500': order.status === 'delivered'
            }"
          >
            <!-- Card Body Top -->
            <div class="p-4 flex-1">
              
              <!-- Header -->
              <div class="flex items-start justify-between pb-3 border-b border-surface-container-high">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-base font-extrabold text-primary">
                      Pedido #{{ padNumber(order.order_number) }}
                    </span>
                    <span class="px-2 py-0.5 rounded-md bg-primary-container text-white text-[10px] font-bold">
                      MESA {{ order.table?.table_number || '0' }}
                    </span>
                  </div>
                  <div class="flex items-center gap-3 mt-1 text-outline text-xs">
                    <span class="flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs">schedule</span>
                      {{ formatTime(order.created_at) }}
                    </span>
                    <span class="text-amber-700 font-semibold flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      {{ getElapsedMinutes(order.created_at) }} min
                    </span>
                  </div>
                </div>

                <!-- Dual Status Badges -->
                <div class="flex flex-col items-end gap-1">
                  <!-- Prep Status -->
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    [ngClass]="{
                      'bg-amber-50 text-amber-800 border border-amber-200': order.status === 'preparing' || order.status === 'pending',
                      'bg-emerald-50 text-emerald-800 border border-emerald-300': order.status === 'ready',
                      'bg-blue-50 text-blue-800 border border-blue-200': order.status === 'delivered'
                    }"
                  >
                    {{ order.status === 'preparing' ? 'PREPARACIÓN' : order.status.toUpperCase() }}
                  </span>

                  <!-- Payment Status -->
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200">
                    {{ order.payment_status === 'paid' ? 'PAGADO' : 'PENDIENTE PAGO' }}
                  </span>
                </div>
              </div>

              <button
                type="button"
                (click)="openOrderDetails(order)"
                class="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-[11px] font-bold text-primary hover:bg-surface-container transition-colors"
              >
                <span class="material-symbols-outlined text-sm">receipt_long</span>
                Ver comanda completa
              </button>

              <!-- Product Line Items -->
              <div class="py-3 space-y-3">
                @for (item of order.items; track item.id) {
                  <div>
                    <div class="flex justify-between items-baseline text-xs">
                      <span class="font-bold text-[#29232E]">{{ item.quantity }} × {{ item.product_name }}</span>
                      <span class="font-semibold text-primary">{{ item.subtotal | currencyCop }}</span>
                    </div>

                    @if (item.flavor || item.size) {
                      <p class="text-[11px] text-on-surface-variant ml-3 mt-0.5">
                        {{ item.size }} • {{ item.flavor }}
                      </p>
                    }

                    @if (item.toppings && item.toppings.length > 0) {
                      <div class="ml-3 mt-1.5 rounded-lg border border-pink-300 bg-pink-50 p-2">
                        <p class="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-pink-900">
                          <span class="material-symbols-outlined text-sm">restaurant</span>
                          Agregar · {{ item.toppings.length }} topping{{ item.toppings.length === 1 ? '' : 's' }}
                        </p>
                        <div class="flex flex-wrap gap-1">
                        @for (top of item.toppings; track top.id) {
                          <span class="px-2 py-1 bg-white text-pink-950 rounded text-[11px] font-bold border border-pink-200">
                            + {{ top.topping_name }}
                          </span>
                        }
                        </div>
                      </div>
                    } @else {
                      <p class="ml-3 mt-1 text-[10px] text-outline">Sin toppings</p>
                    }

                    @if (item.notes) {
                      <p class="text-[10px] italic text-secondary ml-3 mt-1">Nota: {{ item.notes }}</p>
                    }
                  </div>
                }

                @if (order.notes) {
                  <div class="p-2 rounded-lg bg-surface-container-low text-[11px] text-primary border border-outline-variant/30">
                    <strong>Observación General:</strong> {{ order.notes }}
                  </div>
                }
              </div>

            </div>

            <!-- Card Footer -->
            <div class="p-4 bg-surface-container-low/60 border-t border-surface-container-high flex items-center justify-between">
              <div>
                <span class="text-[10px] font-bold uppercase text-outline block">Total Comanda</span>
                <span class="text-base font-bold text-primary tracking-tight">{{ order.total | currencyCop: true }}</span>
              </div>

              <div class="flex gap-2">
                @if (order.status !== 'ready') {
                  <button
                    type="button"
                    (click)="setOrderReady(order.id)"
                    class="h-9 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs border border-outline-variant flex items-center gap-1 active:scale-95 transition-all"
                    title="Avisar al mozo que está listo"
                  >
                    <span>Listo</span>
                  </button>
                }

                <!-- Button Section 22: Marcar como Finalizado -->
                <button
                  type="button"
                  (click)="confirmComplete(order)"
                  class="h-9 px-3.5 rounded-xl bg-primary-container hover:bg-primary text-white font-bold text-xs shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <span class="material-symbols-outlined text-sm">done_all</span>
                  <span>FINALIZAR</span>
                </button>
              </div>
            </div>

          </div>
        }
      </div>

      <!-- Empty State -->
      @if (orderService.activeOrders().length === 0 && !orderService.isLoading() && !orderService.activeOrdersError()) {
        <div class="text-center py-20 bg-white rounded-2xl border border-outline-variant/30 p-8">
          <span class="material-symbols-outlined text-5xl text-outline mb-2">dinner_dining</span>
          <h3 class="text-base font-bold text-primary">No hay pedidos activos en cocina</h3>
          <p class="text-xs text-outline mt-1">
            Los pedidos tomados por los mozos aparecerán aquí en vivo sin recargar la página.
          </p>
        </div>
      }

      @if (detailOrder(); as order) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
          (click)="detailOrder.set(null)"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-details-title"
            class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-outline-variant/40 flex flex-col overflow-hidden"
            (click)="$event.stopPropagation()"
          >
            <header class="p-5 bg-primary-container text-white flex items-start justify-between gap-3">
              <div>
                <h2 id="order-details-title" class="text-lg font-bold">
                  Comanda #{{ padNumber(order.order_number) }}
                </h2>
                <p class="text-xs text-secondary-fixed mt-1">
                  {{ order.table?.table_number ? 'Mesa ' + order.table.table_number : 'Mostrador' }}
                  · {{ order.employee?.full_name || 'Salón' }}
                  · {{ formatDateTime(order.created_at) }}
                </p>
              </div>
              <button
                type="button"
                (click)="detailOrder.set(null)"
                class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                aria-label="Cerrar detalle de comanda"
              >
                <span class="material-symbols-outlined text-lg">close</span>
              </button>
            </header>

            <div class="flex-1 overflow-y-auto p-5 space-y-5 custom-scroll">
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div class="rounded-xl bg-surface-container-low p-3">
                  <span class="block text-[10px] font-bold uppercase text-outline">Estado</span>
                  <span class="text-xs font-bold text-primary">{{ statusLabel(order.status) }}</span>
                </div>
                <div class="rounded-xl bg-surface-container-low p-3">
                  <span class="block text-[10px] font-bold uppercase text-outline">Pago</span>
                  <span class="text-xs font-bold text-primary">{{ order.payment_status === 'paid' ? 'Pagado' : 'Pendiente' }}</span>
                </div>
                <div class="rounded-xl bg-surface-container-low p-3">
                  <span class="block text-[10px] font-bold uppercase text-outline">Mesa</span>
                  <span class="text-xs font-bold text-primary">{{ order.table?.table_number || 'Mostrador' }}</span>
                </div>
                <div class="rounded-xl bg-surface-container-low p-3">
                  <span class="block text-[10px] font-bold uppercase text-outline">Empleado</span>
                  <span class="text-xs font-bold text-primary">{{ order.employee?.full_name || 'Salón' }}</span>
                </div>
              </div>

              <section>
                <h3 class="text-sm font-bold text-primary mb-3">Productos y personalizaciones</h3>
                <div class="space-y-3">
                  @for (item of order.items || []; track item.id) {
                    <article class="rounded-xl border border-outline-variant/40 p-3.5 space-y-2">
                      <div class="flex justify-between gap-3">
                        <div>
                          <h4 class="text-sm font-bold text-on-surface">{{ item.quantity }} × {{ item.product_name }}</h4>
                          <p class="text-[11px] text-outline mt-0.5">
                            @if (item.size) { Tamaño: {{ item.size }} }
                            @if (item.size && item.flavor) { · }
                            @if (item.flavor) { Sabor: {{ item.flavor }} }
                          </p>
                        </div>
                        <span class="text-sm font-bold text-primary shrink-0">{{ item.subtotal | currencyCop: true }}</span>
                      </div>

                      @if (item.toppings?.length) {
                        <div class="rounded-lg bg-pink-50/70 p-2.5">
                          <p class="text-[10px] font-bold uppercase text-primary mb-1">Toppings</p>
                          <ul class="space-y-1">
                            @for (topping of item.toppings; track topping.id) {
                              <li class="flex justify-between gap-2 text-xs text-on-surface">
                                <span>+ {{ topping.topping_name }}</span>
                                <span>{{ topping.price | currencyCop }}</span>
                              </li>
                            }
                          </ul>
                        </div>
                      } @else {
                        <p class="text-[11px] text-outline">Sin toppings</p>
                      }

                      @if (item.notes) {
                        <p class="text-xs text-on-surface-variant"><strong>Nota:</strong> {{ item.notes }}</p>
                      }
                      <p class="text-[10px] text-outline">
                        Precio unitario: {{ item.unit_price | currencyCop }} · Cantidad: {{ item.quantity }}
                      </p>
                    </article>
                  } @empty {
                    <p class="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                      Esta comanda no contiene productos registrados.
                    </p>
                  }
                </div>
              </section>

              @if (order.notes) {
                <div class="rounded-xl border border-secondary-container/40 bg-secondary-container/10 p-3">
                  <h3 class="text-xs font-bold text-primary">Observación general</h3>
                  <p class="mt-1 text-xs text-on-surface-variant">{{ order.notes }}</p>
                </div>
              }

              <section class="border-t border-outline-variant/40 pt-3 space-y-1.5">
                <div class="flex justify-between text-xs text-on-surface-variant">
                  <span>Subtotal</span><span>{{ order.subtotal | currencyCop }}</span>
                </div>
                @if (order.discount > 0) {
                  <div class="flex justify-between text-xs text-on-surface-variant">
                    <span>Descuento</span><span>-{{ order.discount | currencyCop }}</span>
                  </div>
                }
                <div class="flex justify-between text-base font-extrabold text-primary pt-1">
                  <span>Total</span><span>{{ order.total | currencyCop: true }}</span>
                </div>
                <p class="text-[10px] text-outline pt-2">
                  Creado: {{ formatDateTime(order.created_at) }}
                  @if (order.updated_at) { · Actualizado: {{ formatDateTime(order.updated_at) }} }
                  @if (order.delivered_at) { · Entregado: {{ formatDateTime(order.delivered_at) }} }
                  @if (order.completed_at) { · Finalizado: {{ formatDateTime(order.completed_at) }} }
                </p>
              </section>
            </div>
          </section>
        </div>
      }

      <!-- Confirmation Modal for Section 22: MARCAR COMO FINALIZADO -->
      @if (orderToFinalize(); as order) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-outline-variant/40 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <span class="material-symbols-outlined text-xl">task_alt</span>
              </div>
              <div>
                <h3 class="text-base font-bold text-primary">¿Marcar Pedido #{{ padNumber(order.order_number) }} como Finalizado?</h3>
                <p class="text-xs text-outline">Mesa {{ order.table?.table_number }} • Total {{ order.total | currencyCop }}</p>
              </div>
            </div>

            <p class="text-xs text-on-surface-variant leading-relaxed">
              Al confirmar, el pedido se marcará como completado y pasará automáticamente al módulo de
              <strong>"Pendientes de Cobro"</strong> para su liquidación en caja. El pedido NO será eliminado.
            </p>

            <div class="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                (click)="orderToFinalize.set(null)"
                class="px-4 py-2.5 rounded-xl border border-outline-variant text-xs font-bold text-primary hover:bg-surface-container"
              >
                CANCELAR
              </button>
              <button
                type="button"
                (click)="executeFinalize()"
                class="px-4 py-2.5 rounded-xl bg-primary-container hover:bg-primary text-white text-xs font-bold shadow-md"
              >
                SÍ, MARCAR COMO FINALIZADO
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  readonly orderService = inject(OrderService);
  readonly orderToFinalize = signal<Order | null>(null);
  readonly detailOrder = signal<Order | null>(null);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.refreshTimer = setInterval(() => {
      if (!this.orderService.isLoading() && document.visibilityState === 'visible') {
        void this.refresh();
      }
    }, 20_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async refresh(): Promise<void> {
    await this.orderService.loadActiveOrders();
  }

  padNumber(n?: number): string {
    return String(n || 0).padStart(3, '0');
  }

  formatTime(iso?: string): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  }

  getElapsedMinutes(iso?: string): number {
    if (!iso) return 0;
    const diff = Date.now() - new Date(iso).getTime();
    return Math.max(0, Math.floor(diff / 60000));
  }

  formatDateTime(iso?: string | null): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  }

  statusLabel(status: Order['status']): string {
    const labels: Record<Order['status'], string> = {
      pending: 'Pendiente',
      preparing: 'Preparación',
      ready: 'Listo',
      delivered: 'Entregado',
      completed: 'Finalizado',
      cancelled: 'Cancelado',
    };
    return labels[status];
  }

  openOrderDetails(order: Order): void {
    this.detailOrder.set(order);
  }

  async setOrderReady(orderId: string): Promise<void> {
    await this.orderService.markOrderReady(orderId);
  }

  confirmComplete(order: Order): void {
    this.orderToFinalize.set(order);
  }

  async executeFinalize(): Promise<void> {
    const order = this.orderToFinalize();
    if (!order) return;

    if (await this.orderService.markOrderCompleted(order.id)) {
      this.orderToFinalize.set(null);
    }
  }
}
