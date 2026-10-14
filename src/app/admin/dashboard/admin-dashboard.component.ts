import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { CashService } from '../../core/services/cash.service';
import { ReportService, DailyReportSummary } from '../../core/services/report.service';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyCopPipe],
  template: `
    <div class="space-y-6">
      
      <!-- Welcome Banner -->
      <div class="bg-gradient-to-r from-primary-container to-primary rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span class="text-xs uppercase tracking-wider text-secondary-fixed font-bold bg-white/10 px-2.5 py-1 rounded-full">
            Panel de Control General
          </span>
          <h1 class="text-2xl font-bold mt-2">Heladería Candy El Progreso</h1>
          <p class="text-sm text-secondary-fixed/90 mt-1">
            Gestión en tiempo real de pedidos de salón, liquidaciones de caja y catálogo artesanal.
          </p>
        </div>
        <div class="flex gap-2.5">
          <a
            routerLink="/admin/orders"
            class="px-4 py-2.5 rounded-xl bg-secondary-container text-on-secondary-fixed font-bold text-xs hover:brightness-105 shadow-sm transition-all flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-base">receipt_long</span>
            <span>Ver Pedidos ({{ orderService.activeOrders().length }})</span>
          </a>
          <a
            routerLink="/admin/cash"
            class="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 transition-all flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-base">point_of_sale</span>
            <span>Estado de Caja</span>
          </a>
        </div>
      </div>

      @if (reportError()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800" role="alert">
          No se pudieron cargar las métricas de ventas: {{ reportError() }}
        </div>
      }

      <!-- 4 KPI Metrics Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- KPI 1: Ventas del Día -->
        <div class="bg-white p-5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col justify-between hover:border-secondary-container transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-outline uppercase tracking-wider">Ventas del Día</span>
            <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <span class="material-symbols-outlined text-xl">payments</span>
            </div>
          </div>
          <div class="mt-4">
            <h3 class="text-2xl font-extrabold text-emerald-700 tracking-tight">
              {{ summary().grossSales | currencyCop: true }}
            </h3>
            <p class="text-xs text-outline mt-1">
              {{ summary().paidOrdersCount }} comandas cobradas
            </p>
          </div>
        </div>

        <!-- KPI 2: Pedidos Totales -->
        <div class="bg-white p-5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col justify-between hover:border-secondary-container transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-outline uppercase tracking-wider">Total Pedidos</span>
            <div class="w-9 h-9 rounded-xl bg-purple-50 text-primary-container flex items-center justify-center">
              <span class="material-symbols-outlined text-xl">receipt</span>
            </div>
          </div>
          <div class="mt-4">
            <h3 class="text-2xl font-extrabold text-primary tracking-tight">
              {{ summary().totalOrders }}
            </h3>
            <p class="text-xs text-outline mt-1">
              {{ summary().paidOrdersCount }} pagados • {{ summary().cancelledOrdersCount }} cancelados
            </p>
          </div>
        </div>

        <!-- KPI 3: Por Cobrar -->
        <div class="bg-white p-5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col justify-between hover:border-secondary-container transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-outline uppercase tracking-wider">Por Cobrar</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-xl">pending_actions</span>
            </div>
          </div>
          <div class="mt-4">
            <h3 class="text-2xl font-extrabold text-amber-600 tracking-tight">
              {{ orderService.pendingPaymentOrders().length }} comandas
            </h3>
            <p class="text-xs text-outline mt-1">
              Pendientes de liquidar en caja
            </p>
          </div>
        </div>

        <!-- KPI 4: Ticket Promedio -->
        <div class="bg-white p-5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col justify-between hover:border-secondary-container transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-outline uppercase tracking-wider">Ticket Promedio</span>
            <div class="w-9 h-9 rounded-xl bg-pink-50 text-secondary flex items-center justify-center">
              <span class="material-symbols-outlined text-xl">trending_up</span>
            </div>
          </div>
          <div class="mt-4">
            <h3 class="text-2xl font-extrabold text-primary tracking-tight">
              {{ summary().averageTicket | currencyCop }}
            </h3>
            <p class="text-xs text-outline mt-1">
              Consumo promedio por pedido
            </p>
          </div>
        </div>

      </div>

      <!-- Quick Modules Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Left: Active Orders Queue (2 Cols) -->
        <div class="lg:col-span-2 bg-white rounded-2xl p-5 border border-outline-variant/30 shadow-xs space-y-4">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">skillet</span>
              <h3 class="text-base font-bold text-primary">Comandas en Preparación y Salón</h3>
            </div>
            <a routerLink="/admin/orders" class="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              <span>Ver todas</span>
              <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
          </div>

          <div class="space-y-3">
            @for (order of orderService.activeOrders().slice(0, 5); track order.id) {
              <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-primary-container text-white flex items-center justify-center font-bold text-xs">
                    M{{ order.table?.table_number || '0' }}
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-sm text-primary">Pedido #{{ padNumber(order.order_number) }}</span>
                      <span class="text-xs text-outline">({{ order.items?.length || 0 }} productos)</span>
                    </div>
                    <p class="text-xs text-on-surface-variant mt-0.5">
                      Mozo: {{ order.employee?.full_name || 'Personal de Salón' }}
                    </p>
                  </div>
                </div>

                <div class="text-right">
                  <span class="text-sm font-bold text-primary block">{{ order.total | currencyCop }}</span>
                  <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                        [ngClass]="{
                          'bg-amber-100 text-amber-800': order.status === 'preparing' || order.status === 'pending',
                          'bg-emerald-100 text-emerald-800': order.status === 'ready',
                          'bg-blue-100 text-blue-800': order.status === 'delivered'
                        }">
                    {{ order.status }}
                  </span>
                </div>
              </div>
            }

            @if (orderService.activeOrders().length === 0) {
              <div class="text-center py-8 text-outline text-xs">
                No hay pedidos en preparación en este momento.
              </div>
            }
          </div>
        </div>

        <!-- Right: Fast Actions & Cash State -->
        <div class="space-y-6">
          
          <!-- Cash Drawer Box -->
          <div class="bg-white rounded-2xl p-5 border border-outline-variant/30 shadow-xs space-y-3">
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 class="text-sm font-bold text-primary">Estado de la Caja Hoy</h3>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    [ngClass]="cashService.currentRegister() ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'">
                {{ cashService.currentRegister() ? 'Abierta' : 'Cerrada' }}
              </span>
            </div>

            @if (cashService.currentRegister(); as reg) {
              <div class="space-y-2 text-xs">
                <div class="flex justify-between text-on-surface-variant">
                  <span>Base Inicial:</span>
                  <span class="font-bold text-on-surface">{{ reg.opening_amount | currencyCop }}</span>
                </div>
                <div class="flex justify-between text-on-surface-variant">
                  <span>Movimientos Registrados:</span>
                  <span class="font-bold text-on-surface">{{ cashService.movements().length }} transacciones</span>
                </div>
              </div>
              <a
                routerLink="/admin/cash"
                class="block w-full text-center py-2 px-3 bg-primary-container text-white font-bold text-xs rounded-xl hover:bg-primary transition-all mt-3"
              >
                GESTIONAR ARQUEO Y CIERRE
              </a>
            } @else {
              <p class="text-xs text-outline">
                No hay caja abierta. Abre la jornada registrando la base inicial en efectivo.
              </p>
              <a
                routerLink="/admin/cash"
                class="block w-full text-center py-2 px-3 bg-secondary-container text-on-secondary-fixed font-bold text-xs rounded-xl hover:brightness-105 transition-all mt-3"
              >
                ABRIR CAJA DEL DÍA
              </a>
            }
          </div>

          <!-- Employee access management -->
          <div class="bg-white rounded-2xl p-5 border border-outline-variant/30 shadow-xs space-y-3">
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 class="text-sm font-bold text-primary">Acceso de Empleados</h3>
              <span class="material-symbols-outlined text-secondary text-lg">badge</span>
            </div>
            <p class="text-xs text-on-surface-variant leading-relaxed">
              Consulta el personal registrado. El acceso de toda la jornada se controla desde «Modo Salón».
            </p>
            <a
              routerLink="/admin/employees"
              class="block w-full text-center py-2 px-3 bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs rounded-xl border border-outline-variant transition-all"
            >
              ADMINISTRAR PERSONAL
            </a>
          </div>

        </div>

      </div>

    </div>
  `,
})
export class AdminDashboardComponent implements OnInit {
  readonly orderService = inject(OrderService);
  readonly cashService = inject(CashService);
  private readonly reportService = inject(ReportService);
  readonly reportError = signal('');

  readonly summary = signal<DailyReportSummary>({
    grossSales: 0,
    totalOrders: 0,
    averageTicket: 0,
    paidOrdersCount: 0,
    pendingOrdersCount: 0,
    cancelledOrdersCount: 0,
    paymentMethods: [],
    topProducts: [],
    employeeSales: [],
  });

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.reportService.getReportData();
      this.summary.set(data);
    } catch (error) {
      console.error('Error cargando métricas del dashboard:', error);
      this.reportError.set(error instanceof Error ? error.message : 'Error al consultar Supabase.');
    }
  }

  padNumber(n?: number): string {
    return String(n || 0).padStart(3, '0');
  }
}
