import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';
import { Order, PaymentMethod } from '../../core/models/pos.types';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyCopPipe],
  template: `
    <div class="space-y-6 relative">
      
      <!-- Top Title Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-bold text-primary">Pendientes de Cobro</h1>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-800 border border-amber-400/40">
              {{ orderService.pendingPaymentOrders().length }} comandas
            </span>
          </div>
          <p class="text-xs text-on-surface-variant mt-0.5">
            Pedidos finalizados en cocina esperando liquidación contable en caja
          </p>
        </div>

        <button
          type="button"
          (click)="refresh()"
          class="px-3 py-1.5 rounded-xl bg-white hover:bg-surface-container text-primary text-xs font-bold border border-outline-variant/40 flex items-center gap-1 transition-all self-start sm:self-auto"
        >
          <span class="material-symbols-outlined text-sm">refresh</span>
          <span>Actualizar</span>
        </button>
      </div>

      <!-- Pending Orders Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        @for (order of orderService.pendingPaymentOrders(); track order.id) {
          <div
            class="bg-white rounded-2xl border-2 transition-all p-4 flex flex-col justify-between shadow-xs hover:shadow-md"
            [ngClass]="selectedOrderForPayment()?.id === order.id
              ? 'border-primary-container ring-2 ring-secondary-container/40'
              : 'border-outline-variant/40'"
          >
            <!-- Card Body -->
            <div class="space-y-3">
              <div class="flex items-center justify-between pb-2.5 border-b border-surface-container-high">
                <div class="flex items-center gap-2">
                  <span class="text-base font-extrabold text-primary">#{{ padNumber(order.order_number) }}</span>
                  <span class="px-2 py-0.5 rounded bg-primary-container text-white text-[10px] font-bold">
                    Mesa {{ order.table?.table_number || 'Salón' }}
                  </span>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                  Por Cobrar
                </span>
              </div>

              <!-- Product Summary -->
              <div class="space-y-1.5 py-1 text-xs">
                @for (item of order.items; track item.id) {
                  <div class="flex justify-between text-on-surface">
                    <span class="font-medium truncate pr-2">{{ item.quantity }}x {{ item.product_name }}</span>
                    <span class="font-bold text-primary shrink-0">{{ item.subtotal | currencyCop }}</span>
                  </div>
                  @if (item.toppings && item.toppings.length > 0) {
                    <div class="text-[10px] text-secondary-fixed-variant pl-3">
                      + {{ getToppingsNames(item.toppings) }}
                    </div>
                  }
                }
              </div>
            </div>

            <!-- Card Action Footer -->
            <div class="pt-3 border-t border-surface-container-high mt-3 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-outline block uppercase font-bold">Total a Cobrar</span>
                <span class="text-base font-extrabold text-primary">{{ order.total | currencyCop: true }}</span>
              </div>

              <button
                type="button"
                (click)="openPaymentDrawer(order)"
                class="h-9 px-4 rounded-xl bg-primary-container hover:bg-primary text-white font-bold text-xs shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <span class="material-symbols-outlined text-sm">point_of_sale</span>
                <span>REGISTRAR PAGO</span>
              </button>
            </div>

          </div>
        }
      </div>

      <!-- Empty State -->
      @if (orderService.pendingPaymentOrders().length === 0 && !orderService.isLoading()) {
        <div class="text-center py-20 bg-white rounded-2xl border border-outline-variant/30 p-8">
          <div class="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
            <span class="material-symbols-outlined text-3xl">check_circle</span>
          </div>
          <h3 class="text-base font-bold text-primary">¡Al día! No hay pedidos pendientes de cobro</h3>
          <p class="text-xs text-outline mt-1 max-w-sm mx-auto">
            Todas las comandas finalizadas han sido cobradas y asentadas en la caja registradora.
          </p>
        </div>
      }

      <!-- ======================================================= -->
      <!-- LATERAL PAYMENT & SETTLEMENT DRAWER (Fixed 430px Sheet) -->
      <!-- ======================================================= -->
      @if (selectedOrderForPayment(); as order) {
        <div class="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fade-in">
          <div class="w-full max-w-[440px] h-full bg-white flex flex-col justify-between shadow-2xl border-l border-outline-variant/40 animate-slide-left overflow-hidden">
            
            <!-- Drawer Header -->
            <div class="p-4 bg-primary-container text-white flex items-center justify-between border-b border-primary/20 shrink-0">
              <div class="flex items-center gap-2.5">
                <span class="material-symbols-outlined text-secondary-fixed text-2xl">payments</span>
                <div>
                  <h3 class="text-base font-bold leading-tight">Liquidación Exprés</h3>
                  <p class="text-xs text-secondary-fixed-dim">
                    Mesa {{ order.table?.table_number }} • Pedido #{{ padNumber(order.order_number) }}
                  </p>
                </div>
              </div>

              <button
                type="button"
                (click)="closePaymentDrawer()"
                class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <span class="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <!-- Drawer Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll">
              
              <!-- Quick Breakdown Card -->
              <div class="bg-surface-container-low p-3.5 rounded-xl border border-secondary-container/40 space-y-2">
                <div class="space-y-1 pb-2 border-b border-outline-variant/30 text-xs">
                  @for (item of order.items; track item.id) {
                    <div class="flex justify-between text-on-surface">
                      <span>{{ item.quantity }}x {{ item.product_name }}</span>
                      <span class="font-bold">{{ item.subtotal | currencyCop }}</span>
                    </div>
                  }
                </div>

                <div class="flex justify-between text-xs text-on-surface-variant">
                  <span>Subtotal Neto:</span>
                  <span>{{ (order.total * 0.92) | currencyCop }}</span>
                </div>
                <div class="flex justify-between text-xs text-on-surface-variant">
                  <span>IVA / Impoconsumo (8%):</span>
                  <span>{{ (order.total * 0.08) | currencyCop }}</span>
                </div>
                <div class="flex justify-between items-center text-sm font-bold text-primary pt-1 border-t border-outline-variant/30">
                  <span>Total a Cobrar:</span>
                  <span class="text-lg text-primary">{{ order.total | currencyCop: true }}</span>
                </div>
              </div>

              <!-- Payment Method Selector -->
              <div>
                <label class="block text-xs font-bold text-on-surface uppercase tracking-wider mb-2">
                  Método de Pago
                </label>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    (click)="selectedMethod.set('cash')"
                    class="p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all"
                    [ngClass]="selectedMethod() === 'cash'
                      ? 'border-2 border-primary-container bg-secondary-container/20 text-primary font-bold shadow-xs'
                      : 'border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'"
                  >
                    <span class="material-symbols-outlined mb-1">payments</span>
                    <span class="text-xs">Efectivo</span>
                  </button>

                  <button
                    type="button"
                    (click)="selectedMethod.set('nequi')"
                    class="p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all"
                    [ngClass]="selectedMethod() === 'nequi'
                      ? 'border-2 border-primary-container bg-secondary-container/20 text-primary font-bold shadow-xs'
                      : 'border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'"
                  >
                    <span class="material-symbols-outlined mb-1 text-purple-700">qr_code_2</span>
                    <span class="text-xs">Nequi</span>
                  </button>

                  <button
                    type="button"
                    (click)="selectedMethod.set('daviplata')"
                    class="p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all"
                    [ngClass]="selectedMethod() === 'daviplata'
                      ? 'border-2 border-primary-container bg-secondary-container/20 text-primary font-bold shadow-xs'
                      : 'border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'"
                  >
                    <span class="material-symbols-outlined mb-1 text-red-600">smartphone</span>
                    <span class="text-xs">Daviplata</span>
                  </button>

                  <button
                    type="button"
                    (click)="selectedMethod.set('other')"
                    class="p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all"
                    [ngClass]="selectedMethod() === 'other'
                      ? 'border-2 border-primary-container bg-secondary-container/20 text-primary font-bold shadow-xs'
                      : 'border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'"
                  >
                    <span class="material-symbols-outlined mb-1 text-blue-600">credit_card</span>
                    <span class="text-xs">Datáfono</span>
                  </button>

                  <button
                    type="button"
                    (click)="selectedMethod.set('transfer')"
                    class="p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all"
                    [ngClass]="selectedMethod() === 'transfer'
                      ? 'border-2 border-primary-container bg-secondary-container/20 text-primary font-bold shadow-xs'
                      : 'border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'"
                  >
                    <span class="material-symbols-outlined mb-1 text-emerald-600">account_balance</span>
                    <span class="text-xs">Transferencia</span>
                  </button>
                </div>
              </div>

              <!-- Cash Tender Specific Module -->
              @if (selectedMethod() === 'cash') {
                <div class="space-y-3 pt-1">
                  
                  <!-- Quick Preset Bills (COP) -->
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <label class="text-xs font-bold text-on-surface uppercase tracking-wider">
                        Efectivo Recibido
                      </label>
                      <span class="text-[11px] text-primary font-bold">Billetes Rápidos</span>
                    </div>
                    <div class="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        (click)="setCashAmount(order.total)"
                        class="py-2 px-1 bg-surface-container hover:bg-secondary-fixed text-primary font-bold text-xs rounded-xl border border-outline-variant transition-colors"
                      >
                        Exacto
                      </button>
                      <button
                        type="button"
                        (click)="setCashAmount(20000)"
                        class="py-2 px-1 bg-surface-container hover:bg-secondary-fixed text-primary font-bold text-xs rounded-xl border border-outline-variant transition-colors"
                      >
                        $20.000
                      </button>
                      <button
                        type="button"
                        (click)="setCashAmount(50000)"
                        class="py-2 px-1 bg-surface-container hover:bg-secondary-fixed text-primary font-bold text-xs rounded-xl border border-outline-variant transition-colors"
                      >
                        $50.000
                      </button>
                      <button
                        type="button"
                        (click)="setCashAmount(100000)"
                        class="py-2 px-1 bg-surface-container hover:bg-secondary-fixed text-primary font-bold text-xs rounded-xl border border-outline-variant transition-colors"
                      >
                        $100.000
                      </button>
                    </div>

                    <!-- Manual input -->
                    <div class="relative mt-2">
                      <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-primary text-base">$</span>
                      <input
                        type="number"
                        [ngModel]="receivedAmount()"
                        (ngModelChange)="setCashAmount($event)"
                        min="0"
                        step="100"
                        class="w-full pl-8 pr-4 py-2.5 bg-surface-container-lowest border-2 border-primary-container rounded-xl text-lg font-extrabold text-primary focus:outline-none focus:ring-2 focus:ring-secondary-container"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <!-- Tabular Live Readout: CAMBIO A ENTREGAR (VUELTAS) -->
                  <div class="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 text-center shadow-xs">
                    <span class="text-xs font-bold uppercase text-emerald-900 tracking-wider">
                      Cambio a Entregar (Vueltas)
                    </span>
                    <div class="text-2xl font-extrabold text-emerald-700 tracking-tight mt-1">
                      {{ changeDue() | currencyCop: true }}
                    </div>
                    <p class="text-[11px] text-emerald-800 font-medium mt-1">
                      {{ getSuggestedChangeBreakdown(changeDue()) }}
                    </p>
                  </div>

                </div>
              }

              <!-- Electronic Ticket Checkbox -->
              <div class="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="print-ticket"
                  [(ngModel)]="printTicket"
                  class="w-4 h-4 text-primary-container rounded border-outline-variant focus:ring-primary-container"
                />
                <label for="print-ticket" class="text-xs text-on-surface cursor-pointer select-none">
                  Generar soporte / imprimir comprobante de pago
                </label>
              </div>

            </div>

            <!-- Drawer Submit Action -->
            <div class="p-4 bg-white border-t border-surface-container-high space-y-2 shrink-0">
              <button
                type="button"
                [disabled]="isSubmittingPayment() || (selectedMethod() === 'cash' && changeDue() < 0)"
                (click)="confirmPayment(order)"
                class="w-full py-4 bg-primary-container hover:bg-primary text-white font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
              >
                <span class="material-symbols-outlined text-lg">check_circle</span>
                <span>
                  {{ isSubmittingPayment() ? 'Registrando cobro...' : 'CONFIRMAR PAGO (' + (order.total | currencyCop) + ')' }}
                </span>
              </button>
            </div>

          </div>
        </div>
      }

    </div>
  `,
})
export class AdminPaymentsComponent {
  readonly orderService = inject(OrderService);
  private readonly paymentService = inject(PaymentService);

  readonly selectedOrderForPayment = signal<Order | null>(null);
  readonly selectedMethod = signal<PaymentMethod>('cash');
  readonly receivedAmount = signal(0);
  printTicket = true;
  readonly isSubmittingPayment = signal(false);

  async refresh(): Promise<void> {
    await this.orderService.loadPendingPaymentOrders();
  }

  openPaymentDrawer(order: Order): void {
    this.selectedOrderForPayment.set(order);
    this.selectedMethod.set('cash');
    this.receivedAmount.set(order.total);
  }

  closePaymentDrawer(): void {
    this.selectedOrderForPayment.set(null);
  }

  setCashAmount(amount: number): void {
    const parsedAmount = Number(amount);
    this.receivedAmount.set(Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0);
  }

  readonly changeDue = computed(() => {
    const order = this.selectedOrderForPayment();
    if (!order) return 0;
    if (this.selectedMethod() !== 'cash') return 0;
    return Math.max(0, this.receivedAmount() - order.total);
  });

  getSuggestedChangeBreakdown(change: number): string {
    if (change <= 0) return 'Sin cambio (pago exacto)';
    const b20 = Math.floor(change / 20000);
    const rem20 = change % 20000;
    const b10 = Math.floor(rem20 / 10000);
    const rem10 = rem20 % 10000;
    const b5 = Math.floor(rem10 / 5000);
    const rem5 = rem10 % 5000;
    const b2 = Math.floor(rem5 / 2000);
    const rem2 = rem5 % 2000;
    const coins = rem2 > 0 ? ` + $${rem2.toLocaleString('es-CO')} en monedas` : '';

    const parts: string[] = [];
    if (b20 > 0) parts.push(`${b20}x $20k`);
    if (b10 > 0) parts.push(`${b10}x $10k`);
    if (b5 > 0) parts.push(`${b5}x $5k`);
    if (b2 > 0) parts.push(`${b2}x $2k`);

    return 'Sugerencia de cambio: ' + (parts.length > 0 ? parts.join(' + ') + coins : `$${change.toLocaleString('es-CO')}`);
  }

  async confirmPayment(order: Order): Promise<void> {
    this.isSubmittingPayment.set(true);
    try {
      const success = await this.paymentService.registerPayment(
        order.id,
        this.selectedMethod(),
        order.total,
        this.selectedMethod() === 'cash' ? this.receivedAmount() : order.total,
        this.selectedMethod() === 'cash' ? this.changeDue() : 0
      );

      if (success) {
        this.closePaymentDrawer();
        await this.orderService.loadPendingPaymentOrders();
      }
    } finally {
      this.isSubmittingPayment.set(false);
    }
  }

  padNumber(n?: number): string {
    return String(n || 0).padStart(3, '0');
  }

  getToppingsNames(toppings: any[]): string {
    return toppings.map((t) => t.topping_name).join(', ');
  }
}
