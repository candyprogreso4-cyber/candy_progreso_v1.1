import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../core/services/cart.service';
import { OrderService } from '../core/services/order.service';
import { AuthService } from '../core/auth/auth.service';
import { CurrencyCopPipe } from '../shared/pipes/currency-cop.pipe';

@Component({
  selector: 'app-employee-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule, CurrencyCopPipe],
  template: `
    <div class="min-h-screen bg-[#1f1924]/10 flex justify-center items-start sm:py-4">
      <!-- Mobile Viewport Container (390 - 420px standard touch POS) -->
      <div class="w-full max-w-[420px] min-h-screen sm:min-h-[850px] bg-background flex flex-col relative shadow-2xl sm:rounded-[28px] overflow-hidden border border-outline-variant/40">
        
        <!-- Top Sticky Header -->
        <header class="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-primary-container text-surface-container-lowest shadow-sm">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-full overflow-hidden bg-surface-container-lowest p-0.5 shadow-xs shrink-0 flex items-center justify-center">
              <img src="logo.png" alt="Candy El Progreso" class="w-full h-full object-cover rounded-full" />
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-white tracking-tight leading-tight">Candy El Progreso</span>
              <span class="text-[10px] text-secondary-fixed flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                Mozo: {{ auth.employee()?.full_name || auth.currentUserName() }}
              </span>
            </div>
          </div>

          <!-- Table badge or change table button -->
          <div class="flex items-center gap-1.5">
            @if (cartService.selectedTable(); as table) {
              <button
                type="button"
                routerLink="/employee/tables"
                class="flex items-center gap-1 bg-primary/60 hover:bg-primary px-2.5 py-1 rounded-full text-secondary-fixed text-xs font-bold border border-secondary-container/30 transition-colors"
              >
                <span class="material-symbols-outlined text-sm">table_restaurant</span>
                <span>Mesa {{ table.table_number }}</span>
              </button>
            } @else {
              <button
                type="button"
                routerLink="/employee/tables"
                class="flex items-center gap-1 bg-amber-500/20 text-amber-200 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-500/30"
              >
                <span>Sin Mesa</span>
              </button>
            }
          </div>
        </header>

        <!-- Main Scrollable Content Area -->
        <main class="flex-1 px-4 pt-3.5 pb-20 overflow-y-auto">
          <router-outlet></router-outlet>
        </main>

        <!-- Floating Cart Notification Bar (when cart has items) -->
        @if (cartService.itemCount() > 0 && !cartService.isDrawerOpen()) {
          <div class="fixed bottom-16 left-0 right-0 max-w-[420px] mx-auto px-4 z-40 animate-slide-up">
            <button
              type="button"
              (click)="cartService.openDrawer()"
              class="w-full bg-primary-container hover:bg-primary text-white py-3 px-4 rounded-2xl shadow-xl flex items-center justify-between border border-secondary-container/40 active:scale-[0.98] transition-all"
            >
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center font-bold text-xs">
                  {{ cartService.itemCount() }}
                </div>
                <div class="text-left">
                  <span class="text-xs font-bold block text-white">Ver Comanda Activa</span>
                  <span class="text-[11px] text-secondary-fixed font-semibold">
                    {{ cartService.total() | currencyCop: true }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-1 text-xs font-bold text-secondary-fixed">
                <span>REVISAR</span>
                <span class="material-symbols-outlined text-base">expand_less</span>
              </div>
            </button>
          </div>
        }

        <!-- Slide-up Bottom Sheet Cart Drawer -->
        @if (cartService.isDrawerOpen()) {
          <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in">
            <div class="w-full max-w-[420px] max-h-[85vh] bg-surface-container-lowest rounded-t-[28px] flex flex-col shadow-2xl border-t border-outline-variant/30 overflow-hidden animate-slide-up">
              
              <!-- Drawer Header -->
              <div class="p-4 bg-primary-container text-white flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary-fixed">shopping_basket</span>
                  <h3 class="font-bold text-sm">
                    Comanda {{ cartService.selectedTable() ? 'Mesa ' + cartService.selectedTable()?.table_number : 'Mostrador' }}
                  </h3>
                  <span class="bg-secondary-fixed text-primary px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {{ cartService.itemCount() }} ítems
                  </span>
                </div>
                <button
                  type="button"
                  (click)="cartService.closeDrawer()"
                  class="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
                >
                  <span class="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <!-- Drawer Items List -->
              <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll">
                @for (item of cartService.cartItems(); track item.id) {
                  <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
                    <div class="flex items-start justify-between">
                      <div class="flex-1 min-w-0 pr-2">
                        <h4 class="font-bold text-xs text-primary truncate">{{ item.product.name }}</h4>
                        <p class="text-[11px] text-on-surface-variant">
                          {{ item.size }} • {{ item.flavor }}
                        </p>
                        @if (item.toppings && item.toppings.length > 0) {
                          <div class="flex flex-wrap gap-1 mt-1">
                            @for (top of item.toppings; track top.id) {
                              <span class="text-[10px] bg-secondary-fixed text-on-secondary-fixed px-1.5 py-0.5 rounded font-medium">
                                + {{ top.name }}
                              </span>
                            }
                          </div>
                          @if (item.product.has_toppings && item.toppings.length > item.product.max_free_toppings) {
                            <p class="mt-1 text-[10px] font-semibold text-amber-800">
                              Adicionales:
                              {{ (item.toppings.length - item.product.max_free_toppings) * item.product.extra_topping_price * item.quantity | currencyCop }}
                            </p>
                          } @else {
                            <p class="mt-1 text-[10px] text-emerald-700">Toppings incluidos en el producto.</p>
                          }
                        }
                        @if (item.notes) {
                          <p class="text-[10px] italic text-secondary mt-1">Nota: {{ item.notes }}</p>
                        }
                      </div>

                      <span class="text-xs font-bold text-primary shrink-0">
                        {{ item.subtotal | currencyCop }}
                      </span>
                    </div>

                    <!-- Quantity controls and delete -->
                    <div class="flex items-center justify-between pt-2 border-t border-surface-container-high/60">
                      <button
                        type="button"
                        (click)="cartService.removeItem(item.id)"
                        class="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 font-semibold"
                      >
                        <span class="material-symbols-outlined text-sm">delete</span>
                        <span>Eliminar</span>
                      </button>

                      <div class="flex items-center gap-2 bg-surface-container-lowest px-2 py-1 rounded-lg border border-outline-variant">
                        <button
                          type="button"
                          (click)="cartService.updateQuantity(item.id, -1)"
                          class="w-6 h-6 rounded bg-surface-container text-primary font-bold flex items-center justify-center text-xs active:scale-90"
                        >
                          -
                        </button>
                        <span class="w-4 text-center font-bold text-xs text-primary">{{ item.quantity }}</span>
                        <button
                          type="button"
                          (click)="cartService.updateQuantity(item.id, 1)"
                          class="w-6 h-6 rounded bg-primary-container text-white font-bold flex items-center justify-center text-xs active:scale-90"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                }

                <!-- Notes for kitchen -->
                <div class="pt-2">
                  <label class="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                    Notas Generales de la Comanda:
                  </label>
                  <textarea
                    [(ngModel)]="orderNotes"
                    rows="2"
                    placeholder="Instrucciones para barra y cocina..."
                    class="w-full text-xs p-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none resize-none"
                  ></textarea>
                </div>
              </div>

              <!-- Drawer Footer & Actions -->
              <div class="p-4 bg-surface-container-lowest border-t border-surface-container-high space-y-2">
                <div class="flex justify-between items-center text-xs text-on-surface-variant">
                  <span>Subtotal Neto:</span>
                  <span class="font-bold text-on-surface">{{ cartService.total() | currencyCop }}</span>
                </div>
                <div class="flex justify-between items-center text-xs text-on-surface-variant">
                  <span>Impoconsumo (8%):</span>
                  <span class="font-bold text-emerald-700">Incluido</span>
                </div>
                <div class="flex justify-between items-center pt-1 border-t border-surface-container-high">
                  <span class="text-sm font-bold text-primary">Total a Pagar:</span>
                  <span class="text-base font-bold text-primary">{{ cartService.total() | currencyCop: true }}</span>
                </div>

                <div class="pt-2 space-y-2">
                  <button
                    type="button"
                    [disabled]="isSubmittingOrder()"
                    (click)="submitOrder()"
                    class="w-full py-3.5 bg-primary-container hover:bg-primary text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
                  >
                    <span class="material-symbols-outlined text-lg">check_circle</span>
                    <span>{{ isSubmittingOrder() ? 'Enviando comanda...' : 'CONFIRMAR Y ENVIAR PEDIDO' }}</span>
                  </button>

                  <button
                    type="button"
                    (click)="cartService.closeDrawer()"
                    class="w-full py-2.5 bg-surface-container text-primary font-bold text-xs rounded-xl border border-outline-variant active:scale-98 transition-all"
                  >
                    SEGUIR AGREGANDO
                  </button>
                </div>
              </div>

            </div>
          </div>
        }

        <!-- Bottom Navigation Bar (Fija ergonómica) -->
        <nav class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] z-30 bg-surface-container-lowest border-t border-surface-container-high grid grid-cols-4 py-2 px-1 text-center shadow-lg">
          <a
            routerLink="/employee/tables"
            routerLinkActive="text-primary font-bold"
            class="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors py-1"
          >
            <span class="material-symbols-outlined text-xl">table_restaurant</span>
            <span class="text-[10px] mt-0.5">Mesas</span>
          </a>
          <a
            routerLink="/employee/menu"
            routerLinkActive="text-primary font-bold"
            class="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors py-1"
          >
            <span class="material-symbols-outlined text-xl">menu_book</span>
            <span class="text-[10px] mt-0.5">Menú</span>
          </a>
          <a
            routerLink="/employee/orders"
            routerLinkActive="text-primary font-bold"
            class="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors py-1"
          >
            <span class="material-symbols-outlined text-xl">receipt_long</span>
            <span class="text-[10px] mt-0.5">Mis Pedidos</span>
          </a>
          <button
            type="button"
            (click)="handleSignOut()"
            class="flex flex-col items-center justify-center text-rose-600 hover:text-rose-800 transition-colors py-1"
          >
            <span class="material-symbols-outlined text-xl">logout</span>
            <span class="text-[10px] mt-0.5">Salir</span>
          </button>
        </nav>

      </div>
    </div>
  `,
})
export class EmployeeLayoutComponent {
  readonly cartService = inject(CartService);
  readonly orderService = inject(OrderService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  get orderNotes(): string {
    return this.cartService.orderNotes();
  }

  set orderNotes(value: string) {
    this.cartService.orderNotes.set(value);
  }
  readonly isSubmittingOrder = signal(false);

  async submitOrder(): Promise<void> {
    if (this.cartService.cartItems().length === 0) return;

    this.isSubmittingOrder.set(true);
    try {
      const tableId = this.cartService.selectedTable()?.id || null;

      const res = await this.orderService.createOrder(
        tableId,
        this.orderNotes,
        this.cartService.cartItems()
      );

      if (res.success) {
        this.cartService.clearCart();
        this.orderNotes = '';
        this.router.navigate(['/employee/orders']);
      }
    } finally {
      this.isSubmittingOrder.set(false);
    }
  }

  handleSignOut(): void {
    if (confirm('¿Deseas cerrar tu sesión del turno actual?')) {
      void this.auth.signOut('employee');
    }
  }
}
