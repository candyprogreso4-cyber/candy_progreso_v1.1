import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../core/services/order.service';
import { AuthService } from '../../core/auth/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { Order } from '../../core/models/pos.types';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';

@Component({
  selector: 'app-employee-orders',
  standalone: true,
  imports: [CommonModule, CurrencyCopPipe],
  template: `
    <div class="space-y-4 pb-28">
      
      <!-- Sub-Header / Waiter Badge -->
      <section class="bg-surface-container-low -mx-4 px-4 py-3 border-b border-surface-container-high flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-primary tracking-tight">Mis Pedidos</h2>
          <p class="text-xs text-on-surface-variant">Gestión de entregas en salón</p>
        </div>
        <div class="flex items-center gap-2 bg-surface-container-lowest py-1 px-2.5 rounded-xl border border-surface-container-high shadow-xs">
          <div class="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs">
            {{ getInitials(auth.employee()?.full_name || auth.currentUserName()) }}
          </div>
          <span class="text-xs font-bold text-primary">{{ auth.employee()?.full_name || auth.currentUserName() }}</span>
        </div>
      </section>

      <!-- Operational Notice Restriction -->
      <div class="p-3 bg-secondary-fixed/30 rounded-xl border border-secondary-fixed flex items-start gap-2.5">
        <span class="material-symbols-outlined text-on-secondary-fixed text-lg shrink-0 mt-0.5">info</span>
        <p class="text-xs text-on-secondary-fixed leading-relaxed">
          <strong>Aviso Operativo:</strong> Solo la Administración registra pagos y caja. Tu rol es tomar pedidos, verificar preparación y entrega en mesa.
        </p>
      </div>

      @if (orderService.employeeOrdersError()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800" role="alert">
          <p class="font-semibold">No se pudieron cargar tus pedidos.</p>
          <p class="mt-1">{{ orderService.employeeOrdersError() }}</p>
          <button
            type="button"
            (click)="fetchOrders()"
            class="mt-2 rounded-lg bg-white px-3 py-2 font-bold text-primary border border-rose-200"
          >
            Reintentar
          </button>
        </div>
      }

      <!-- Filter Pills -->
      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        <button
          type="button"
          (click)="activeFilter.set('all')"
          class="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all active:scale-95"
          [ngClass]="activeFilter() === 'all'
            ? 'bg-primary-container text-white shadow-xs'
            : 'bg-surface-container-lowest text-on-surface-variant border border-surface-container-high'"
        >
          Todos ({{ orders().length }})
        </button>
        <button
          type="button"
          (click)="activeFilter.set('preparing')"
          class="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1"
          [ngClass]="activeFilter() === 'preparing'
            ? 'bg-primary-container text-white shadow-xs'
            : 'bg-surface-container-lowest text-on-surface-variant border border-surface-container-high'"
        >
          <span class="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>En Preparación ({{ preparingCount() }})</span>
        </button>
        <button
          type="button"
          (click)="activeFilter.set('ready')"
          class="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1"
          [ngClass]="activeFilter() === 'ready'
            ? 'bg-primary-container text-white shadow-xs'
            : 'bg-surface-container-lowest text-on-surface-variant border border-surface-container-high'"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Listos ({{ readyCount() }})</span>
        </button>
        <button
          type="button"
          (click)="activeFilter.set('delivered')"
          class="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1"
          [ngClass]="activeFilter() === 'delivered'
            ? 'bg-primary-container text-white shadow-xs'
            : 'bg-surface-container-lowest text-on-surface-variant border border-surface-container-high'"
        >
          <span class="w-2 h-2 rounded-full bg-slate-400"></span>
          <span>Entregados ({{ deliveredCount() }})</span>
        </button>
      </div>

      <!-- Orders List -->
      <div class="space-y-3">
        @for (order of filteredOrders(); track order.id) {
          <div class="bg-surface-container-lowest rounded-xl p-3.5 shadow-xs border border-outline-variant/30 space-y-2.5">
            
            <!-- Card Header -->
            <div class="flex items-center justify-between pb-2 border-b border-surface-container-high">
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm text-primary">#{{ padNumber(order.order_number) }}</span>
                <span class="px-2 py-0.5 rounded bg-primary-container text-white text-[10px] font-bold">
                  Mesa {{ order.table?.table_number || 'Salón' }}
                </span>
              </div>
              
              <!-- Status Pill -->
              <span
                class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                [ngClass]="{
                  'bg-amber-100 text-amber-800 border border-amber-300': order.status === 'preparing' || order.status === 'pending',
                  'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse': order.status === 'ready',
                  'bg-slate-100 text-slate-700 border border-slate-300': order.status === 'delivered' || order.status === 'completed'
                }"
              >
                @switch (order.status) {
                  @case ('preparing') { En Cocina }
                  @case ('ready') { ¡Listo para Entregar! }
                  @case ('delivered') { Entregado }
                  @case ('completed') { Finalizado }
                  @default { Pendiente }
                }
              </span>
            </div>

            <!-- Items list in ticket -->
            <div class="space-y-1.5 py-1">
              @for (item of order.items; track item.id) {
                <div class="text-xs">
                  <div class="flex justify-between font-semibold text-on-surface">
                    <span>{{ item.quantity }}x {{ item.product_name }}</span>
                    <span>{{ item.subtotal | currencyCop }}</span>
                  </div>
                  @if (item.size || item.flavor) {
                    <p class="text-[11px] text-outline ml-3">
                      {{ item.size }} • {{ item.flavor }}
                    </p>
                  }
                  @if (item.toppings && item.toppings.length > 0) {
                    <div class="ml-3 mt-1 rounded-lg bg-pink-50/70 border border-pink-100 p-2">
                      <p class="text-[9px] uppercase font-bold text-primary mb-1">Toppings</p>
                      <div class="flex flex-wrap gap-1">
                      @for (t of item.toppings; track t.id) {
                        <span class="text-[10px] bg-[#FFF0F5] text-primary px-1.5 py-0.2 rounded border border-pink-200">
                          + {{ t.topping_name }}
                        </span>
                      }
                      </div>
                    </div>
                  } @else {
                    <p class="text-[10px] text-outline ml-3 mt-0.5">Sin toppings registrados</p>
                  }
                  @if (item.notes) {
                    <p class="text-[10px] italic text-secondary ml-3 mt-0.5">Nota: {{ item.notes }}</p>
                  }
                </div>
              }
            </div>

            <!-- Card Footer -->
            <div class="pt-2 border-t border-surface-container-high flex items-center justify-between">
              <div>
                <span class="text-[10px] text-outline block">Total Comanda</span>
                <span class="text-sm font-bold text-primary">{{ order.total | currencyCop: true }}</span>
              </div>

              <!-- Action: If ready, show Deliver button -->
              @if (order.status === 'ready') {
                <button
                  type="button"
                  (click)="markAsDelivered(order.id)"
                  class="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                >
                  <span class="material-symbols-outlined text-sm">room_service</span>
                  <span>ENTREGAR EN MESA</span>
                </button>
              } @else if (order.status === 'delivered') {
                <span class="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">check_circle</span>
                  Entregado
                </span>
              } @else {
                <span class="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm animate-spin">sync</span>
                  Preparando en barra...
                </span>
              }
            </div>

          </div>
        }

        @if (filteredOrders().length === 0 && !orderService.employeeOrdersError()) {
          <div class="text-center py-12 px-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
            <span class="material-symbols-outlined text-4xl text-outline mb-2">receipt_long</span>
            <h4 class="text-sm font-bold text-on-surface">No hay pedidos en este estado</h4>
            <p class="text-xs text-outline mt-1">Los nuevos pedidos se sincronizarán en tiempo real.</p>
          </div>
        }
      </div>

    </div>
  `,
})
export class EmployeeOrdersComponent implements OnInit {
  readonly orderService = inject(OrderService);
  private readonly realtime = inject(RealtimeService);
  readonly auth = inject(AuthService);

  readonly orders = signal<Order[]>([]);
  readonly activeFilter = signal<'all' | 'preparing' | 'ready' | 'delivered'>('all');

  private cleanupRealtime: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    await this.fetchOrders();

    // Suscripción Realtime
    this.cleanupRealtime = this.realtime.subscribe((change) => {
      if (change.table === 'orders') {
        void this.fetchOrders();
      }
    });
  }

  async fetchOrders(): Promise<void> {
    const list = await this.orderService.loadEmployeeOrders();
    this.orders.set(list);
  }

  readonly preparingCount = computed(() =>
    this.orders().filter((o) => o.status === 'preparing' || o.status === 'pending').length
  );

  readonly readyCount = computed(() =>
    this.orders().filter((o) => o.status === 'ready').length
  );

  readonly deliveredCount = computed(() =>
    this.orders().filter((o) => o.status === 'delivered' || o.status === 'completed').length
  );

  readonly filteredOrders = computed(() => {
    const f = this.activeFilter();
    if (f === 'all') return this.orders();
    if (f === 'preparing') return this.orders().filter((o) => o.status === 'preparing' || o.status === 'pending');
    if (f === 'ready') return this.orders().filter((o) => o.status === 'ready');
    if (f === 'delivered') return this.orders().filter((o) => o.status === 'delivered' || o.status === 'completed');
    return this.orders();
  });

  async markAsDelivered(orderId: string): Promise<void> {
    await this.orderService.markOrderDelivered(orderId);
    await this.fetchOrders();
  }

  padNumber(n?: number): string {
    return String(n || 0).padStart(3, '0');
  }

  getInitials(name: string): string {
    if (!name) return 'CM';
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }
}
