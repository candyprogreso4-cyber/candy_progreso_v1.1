import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService, DailyReportSummary } from '../../core/services/report.service';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyCopPipe],
  template: `
    <div class="space-y-6">
      
      <!-- Top Title and Date Picker -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-primary">Reportes &amp; Analítica Comercial</h1>
          <p class="text-xs text-on-surface-variant mt-0.5">
            Consolidado financiero, ventas por método de recaudo y ranking de productos
          </p>
        </div>

        <div class="flex items-center gap-2 self-start sm:self-auto bg-white p-1.5 rounded-xl border border-outline-variant/40 shadow-xs">
          <span class="material-symbols-outlined text-outline text-sm ml-2">calendar_today</span>
          <input
            type="date"
            [(ngModel)]="selectedDate"
            (change)="fetchReports()"
            class="text-xs font-bold text-primary bg-transparent outline-none pr-2"
          />
        </div>
      </div>

      <!-- Financial KPIs Row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div class="bg-white p-5 rounded-2xl border border-outline-variant/30 shadow-xs">
          <span class="text-[10px] font-bold uppercase text-outline">Recaudo Bruto Total</span>
          <div class="text-2xl font-extrabold text-emerald-700 mt-1">
            {{ summary().grossSales | currencyCop: true }}
          </div>
          <p class="text-xs text-outline mt-1">{{ summary().paidOrdersCount }} comandas pagadas</p>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-outline-variant/30 shadow-xs">
          <span class="text-[10px] font-bold uppercase text-outline">Total Comandas</span>
          <div class="text-2xl font-extrabold text-primary mt-1">
            {{ summary().totalOrders }}
          </div>
          <p class="text-xs text-outline mt-1">{{ summary().cancelledOrdersCount }} canceladas</p>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-outline-variant/30 shadow-xs">
          <span class="text-[10px] font-bold uppercase text-outline">Ticket Promedio</span>
          <div class="text-2xl font-extrabold text-primary mt-1">
            {{ summary().averageTicket | currencyCop }}
          </div>
          <p class="text-xs text-outline mt-1">Gasto medio por cliente</p>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-outline-variant/30 shadow-xs">
          <span class="text-[10px] font-bold uppercase text-outline">Pendiente de Cobro</span>
          <div class="text-2xl font-extrabold text-amber-600 mt-1">
            {{ summary().pendingOrdersCount }} comandas
          </div>
          <p class="text-xs text-outline mt-1">Por liquidar en caja</p>
        </div>

      </div>

      <!-- Reports Detail Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Left: Payment Methods Breakdown (6 cols) -->
        <div class="lg:col-span-6 bg-white rounded-2xl p-5 border border-outline-variant/30 shadow-xs space-y-4">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <h3 class="text-sm font-bold text-primary">Recaudos por Método de Pago</h3>
            <span class="text-xs text-outline font-semibold">100% Cuadrado</span>
          </div>

          <div class="space-y-3">
            @for (m of summary().paymentMethods; track m.method) {
              <div class="space-y-1">
                <div class="flex justify-between items-center text-xs">
                  <span class="font-bold text-on-surface">{{ m.label }} ({{ m.count }} pagos)</span>
                  <span class="font-extrabold text-primary">{{ m.total | currencyCop }}</span>
                </div>
                
                <!-- Progress bar -->
                <div class="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    class="h-full bg-primary-container rounded-full transition-all duration-500"
                    [style.width.%]="m.percentage"
                  ></div>
                </div>
                <div class="flex justify-end text-[10px] text-outline font-semibold">
                  {{ m.percentage | number:'1.1-1' }}% del total
                </div>
              </div>
            }

            @if (summary().paymentMethods.length === 0) {
              <div class="text-center py-8 text-xs text-outline">
                No se registraron cobros en esta fecha.
              </div>
            }
          </div>
        </div>

        <!-- Right: Top Products Ranking (6 cols) -->
        <div class="lg:col-span-6 bg-white rounded-2xl p-5 border border-outline-variant/30 shadow-xs space-y-4">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <h3 class="text-sm font-bold text-primary">Top Productos Más Vendidos</h3>
            <span class="text-xs text-outline">Ranking por unidades</span>
          </div>

          <div class="divide-y divide-outline-variant/15 text-xs">
            @for (prod of summary().topProducts; track prod.productName; let idx = $index) {
              <div class="py-2.5 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="w-6 h-6 rounded-full bg-surface-container text-primary font-bold text-xs flex items-center justify-center">
                    {{ idx + 1 }}
                  </span>
                  <div>
                    <h4 class="font-bold text-on-surface">{{ prod.productName }}</h4>
                    <span class="text-[11px] text-outline">{{ prod.quantity }} unidades vendidas</span>
                  </div>
                </div>

                <span class="font-bold text-primary text-xs">{{ prod.total | currencyCop }}</span>
              </div>
            }

            @if (summary().topProducts.length === 0) {
              <div class="text-center py-8 text-xs text-outline">
                Sin datos de ventas para la fecha seleccionada.
              </div>
            }
          </div>
        </div>

        <!-- Bottom: Waiter Performance (12 cols) -->
        <div class="lg:col-span-12 bg-white rounded-2xl p-5 border border-outline-variant/30 shadow-xs space-y-4">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <h3 class="text-sm font-bold text-primary">Rendimiento y Pedidos por Personal de Salón</h3>
            <span class="text-xs text-outline">Mozos activos</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            @for (emp of summary().employeeSales; track emp.employeeName) {
              <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center font-bold text-xs">
                    {{ emp.employeeName.substring(0, 2).toUpperCase() }}
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-on-surface">{{ emp.employeeName }}</h4>
                    <span class="text-[10px] text-outline">{{ emp.ordersCount }} comandas atendidas</span>
                  </div>
                </div>
                <div class="mt-3 pt-2 border-t border-outline-variant/30 flex justify-between items-center text-xs">
                  <span class="text-outline">Recaudo:</span>
                  <span class="font-bold text-primary">{{ emp.total | currencyCop }}</span>
                </div>
              </div>
            }

            @if (summary().employeeSales.length === 0) {
              <div class="col-span-4 text-center py-6 text-xs text-outline">
                Sin registros de mozos para esta fecha.
              </div>
            }
          </div>
        </div>

      </div>

    </div>
  `,
})
export class AdminReportsComponent implements OnInit {
  private readonly reportService = inject(ReportService);

  selectedDate = new Date().toISOString().split('T')[0];
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
    await this.fetchReports();
  }

  async fetchReports(): Promise<void> {
    const data = await this.reportService.getReportData(this.selectedDate);
    this.summary.set(data);
  }
}
