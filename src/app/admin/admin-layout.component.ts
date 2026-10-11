import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { OrderService } from '../core/services/order.service';
import { CashService } from '../core/services/cash.service';
import { RealtimeService } from '../core/services/realtime.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="h-screen bg-[#F6F5F8] text-on-surface antialiased overflow-hidden flex font-sans select-none">
      
      <!-- ========================================== -->
      <!-- 1. FIXED SIDEBAR (260px Artisanal Plum)   -->
      <!-- ========================================== -->
      <aside class="fixed top-0 left-0 h-screen w-64 flex flex-col justify-between z-40 bg-primary-container text-secondary-fixed shadow-md border-r border-outline-variant/20">
        <div class="w-64 h-full p-4 flex flex-col justify-between shrink-0 overflow-y-auto custom-scroll">
          
          <!-- Upper Section: Branding & Modules -->
          <div class="space-y-4">
            
            <!-- Logo and Terminal Subtitle -->
            <div class="flex items-center gap-3 px-2 py-1.5 border-b border-outline-variant/15 pb-3">
              <div class="w-10 h-10 rounded-full bg-white p-0.5 shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
                <img src="logo.png" alt="Logo Candy El Progreso" class="w-full h-full object-cover rounded-full" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-bold text-white truncate tracking-tight">Candy El Progreso</span>
                <div class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span class="text-[10px] text-secondary-fixed/80">Caja 01 - Principal</span>
                </div>
              </div>
            </div>

            <!-- Quick Action: Ir a Modo Empleado / Salón -->
            <button
              type="button"
              (click)="openEmployeeMode()"
              class="w-full py-2.5 px-3 rounded-xl bg-secondary-container text-on-secondary-fixed font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:brightness-105 active:scale-[0.99] transition-all"
            >
              <span class="material-symbols-outlined text-lg">{{ auth.salonAccessEnabled() ? 'storefront' : 'add_circle' }}</span>
              <span>{{ auth.salonAccessEnabled() ? 'Entrar al salón (Acceso abierto)' : 'Habilitar y abrir modo salón' }}</span>
            </button>
            @if (auth.salonAccessEnabled()) {
              <button
                type="button"
                (click)="closeSalonAccess()"
                class="w-full py-2 px-3 -mt-2 rounded-xl bg-rose-950/40 text-rose-200 border border-rose-300/20 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-950/70 transition-colors"
              >
                <span class="material-symbols-outlined text-base">lock</span>
                <span>Cerrar acceso al salón</span>
              </button>
            }

            <!-- Navigation Tabs (Exact 10 Modules) -->
            <nav class="space-y-1">
              
              <!-- 1. Inicio -->
              <a
                routerLink="/admin/dashboard"
                routerLinkActive="bg-secondary-container/20 text-secondary-fixed font-bold border-l-4 border-secondary-container"
                class="flex items-center justify-between px-3 py-2 rounded-lg text-on-primary-container hover:bg-primary/40 hover:text-white transition-colors text-xs"
              >
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-lg">dashboard</span>
                  <span>Inicio</span>
                </div>
              </a>

              <!-- 2. Pedidos -->
              <a
                routerLink="/admin/orders"
                routerLinkActive="bg-secondary-container/20 text-secondary-fixed font-bold border-l-4 border-secondary-container"
                class="flex items-center justify-between px-3 py-2 rounded-lg text-on-primary-container hover:bg-primary/40 hover:text-white transition-colors text-xs"
              >
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-lg">receipt_long</span>
                  <span>Pedidos Activos</span>
                </div>
                @if (orderService.activeOrders().length > 0) {
                  <span class="px-2 py-0.5 rounded-full bg-primary/60 text-secondary-fixed text-[10px] font-bold border border-secondary-container/20">
                    {{ orderService.activeOrders().length }}
                  </span>
                }
              </a>

              <!-- 3. Pendientes de cobro -->
              <a
                routerLink="/admin/payments"
                routerLinkActive="bg-secondary-container/20 text-secondary-fixed font-bold border-l-4 border-secondary-container"
                class="flex items-center justify-between px-3 py-2 rounded-lg text-on-primary-container hover:bg-primary/40 hover:text-white transition-colors text-xs"
              >
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-lg text-amber-300">pending_actions</span>
                  <span>Pendientes de cobro</span>
                </div>
                @if (orderService.pendingPaymentOrders().length > 0) {
                  <span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
                    {{ orderService.pendingPaymentOrders().length }}
                  </span>
                }
              </a>

              <!-- 4. Productos -->
              <a
                routerLink="/admin/products"
                routerLinkActive="bg-secondary-container/20 text-secondary-fixed font-bold border-l-4 border-secondary-container"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-on-primary-container hover:bg-primary/40 hover:text-white transition-colors text-xs"
              >
                <span class="material-symbols-outlined text-lg">icecream</span>
                <span>Productos &amp; Menú</span>
              </a>

              <!-- Personal y acceso -->
              <a
                routerLink="/admin/employees"
                routerLinkActive="bg-secondary-container/20 text-secondary-fixed font-bold border-l-4 border-secondary-container"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-on-primary-container hover:bg-primary/40 hover:text-white transition-colors text-xs"
              >
                <span class="material-symbols-outlined text-lg">badge</span>
                <span>Personal y acceso</span>
              </a>

              <!-- Caja & Cierre de Jornada -->
              <a
                routerLink="/admin/cash"
                routerLinkActive="bg-secondary-container/20 text-secondary-fixed font-bold border-l-4 border-secondary-container"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-on-primary-container hover:bg-primary/40 hover:text-white transition-colors text-xs"
              >
                <span class="material-symbols-outlined text-lg">point_of_sale</span>
                <span>Caja &amp; Arqueo</span>
              </a>

              <!-- Reportes -->
              <a
                routerLink="/admin/reports"
                routerLinkActive="bg-secondary-container/20 text-secondary-fixed font-bold border-l-4 border-secondary-container"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-on-primary-container hover:bg-primary/40 hover:text-white transition-colors text-xs"
              >
                <span class="material-symbols-outlined text-lg">analytics</span>
                <span>Reportes &amp; Ventas</span>
              </a>

            </nav>
          </div>

          <!-- Footer del Sidebar: Perfil & Cerrar Turno -->
          <div class="pt-4 border-t border-outline-variant/20 space-y-3">
            <div class="p-2.5 rounded-xl bg-primary/40 border border-outline-variant/15 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="relative">
                  <div class="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center font-bold text-xs">
                    {{ getInitials(auth.currentUserName()) }}
                  </div>
                  <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-primary-container rounded-full"></span>
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-xs font-bold text-white truncate">{{ auth.currentUserName() }}</span>
                  <span class="text-[10px] text-secondary-fixed-dim">Administrador</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              (click)="handleSignOut()"
              class="w-full py-2 px-3 rounded-lg text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-950/40 flex items-center justify-center gap-2 transition-colors"
            >
              <span class="material-symbols-outlined text-base">logout</span>
              <span>Cerrar Sesión</span>
            </button>
          </div>

        </div>
      </aside>

      <!-- ========================================== -->
      <!-- 2. MAIN WORKSPACE VIEWPORT (Fluid)         -->
      <!-- ========================================== -->
      <div class="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        
        <!-- Top App Bar Desktop -->
        <header class="h-16 px-6 bg-white border-b border-outline-variant/30 flex items-center justify-between shrink-0 shadow-xs">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-bold text-primary">Terminal POS • Administración Candy</h2>
            <span class="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              En Línea con Supabase Realtime
            </span>
          </div>

          <div class="flex items-center gap-4">
            <span class="text-xs text-on-surface-variant font-medium">
              {{ todayFormatted }}
            </span>
            <div class="h-6 w-px bg-outline-variant/40"></div>
            <button
              type="button"
              routerLink="/admin/orders"
              class="relative p-2 rounded-lg text-primary hover:bg-surface-container transition-colors"
              title="Pedidos"
            >
              <span class="material-symbols-outlined">notifications</span>
              @if (orderService.activeOrders().length > 0) {
                <span class="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
                <span class="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full"></span>
              }
            </button>
          </div>
        </header>

        <!-- Dynamic Content Router Outlet -->
        <main class="flex-1 overflow-y-auto p-6 custom-scroll">
          <router-outlet></router-outlet>
        </main>
      </div>

    </div>
  `,
})
export class AdminLayoutComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly orderService = inject(OrderService);
  readonly cashService = inject(CashService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);

  readonly todayFormatted = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  ngOnInit(): void {
    this.realtime.subscribe((change) => {
      if (change.table === 'orders' || change.table === 'payments') {
        void this.orderService.loadActiveOrders();
        void this.orderService.loadPendingPaymentOrders();
      }
      if (change.table === 'cash_registers') {
        void this.cashService.loadCurrentRegister();
      }
    });

    void Promise.all([
      this.orderService.loadActiveOrders(),
      this.orderService.loadPendingPaymentOrders(),
      this.cashService.loadCurrentRegister(),
    ]);
  }

  openEmployeeMode(): void {
    const enter = async (): Promise<void> => {
      if (!this.auth.salonAccessEnabled()) {
        const enabled = await this.auth.setSalonAccess(true);
        if (!enabled) return;
      }
      await this.router.navigate(['/employee/tables']);
    };
    void enter();
  }

  closeSalonAccess(): void {
    void this.auth.setSalonAccess(false);
  }

  getInitials(name: string): string {
    if (!name) return 'LG';
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  handleSignOut(): void {
    if (confirm('¿Cerrar sesión de administrador?')) {
      void this.auth.signOut();
    }
  }
}
