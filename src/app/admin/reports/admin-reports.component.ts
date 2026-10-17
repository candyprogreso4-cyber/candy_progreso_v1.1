import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Worksheet } from 'exceljs';
import {
  ReportService,
  DailyReportSummary,
  WeeklyReportSummary,
} from '../../core/services/report.service';
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

      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="inline-flex rounded-xl border border-outline-variant/40 bg-white p-1 shadow-xs">
          <button
            type="button"
            (click)="selectReport('daily')"
            class="rounded-lg px-3 py-2 text-xs font-bold transition-colors"
            [ngClass]="reportMode() === 'daily' ? 'bg-primary-container text-white' : 'text-primary hover:bg-surface-container'"
          >Reporte diario</button>
          <button
            type="button"
            (click)="selectReport('weekly')"
            class="rounded-lg px-3 py-2 text-xs font-bold transition-colors"
            [ngClass]="reportMode() === 'weekly' ? 'bg-primary-container text-white' : 'text-primary hover:bg-surface-container'"
          >Reporte semanal</button>
        </div>

        @if (reportMode() === 'daily') {
          <label class="flex items-center gap-2 bg-white p-2 rounded-xl border border-outline-variant/40 shadow-xs">
            <span class="material-symbols-outlined text-outline text-sm">calendar_today</span>
            <input
              type="date"
              [(ngModel)]="selectedDate"
              (change)="fetchReports()"
              class="text-xs font-bold text-primary bg-transparent outline-none"
            />
          </label>
        } @else {
          <div class="flex flex-wrap items-center gap-2">
            <label class="flex items-center gap-2 bg-white p-2 rounded-xl border border-outline-variant/40 shadow-xs">
              <span class="material-symbols-outlined text-outline text-sm">date_range</span>
              <span class="text-[10px] font-bold text-outline">Semana de</span>
              <input
                type="date"
                [(ngModel)]="selectedWeek"
                (change)="fetchWeeklyReport()"
                class="text-xs font-bold text-primary bg-transparent outline-none"
              />
            </label>
            <button
              type="button"
              (click)="downloadWeeklyExcel()"
              [disabled]="!weeklySummary() || weeklyLoading() || exportingExcel()"
              class="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span class="material-symbols-outlined text-base">download</span>
              {{ exportingExcel() ? 'Preparando Excel...' : 'Descargar Excel' }}
            </button>
          </div>
        }
      </div>

      @if (dailyError()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800" role="alert">
          No se pudo cargar el reporte diario: {{ dailyError() }}
          <button type="button" (click)="fetchReports()" class="ml-2 font-bold underline">Reintentar</button>
        </div>
      }
      @if (weeklyError()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800" role="alert">
          No se pudo cargar el reporte semanal: {{ weeklyError() }}
          <button type="button" (click)="fetchWeeklyReport()" class="ml-2 font-bold underline">Reintentar</button>
        </div>
      }
      @if (excelError()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800" role="alert">
          No se pudo generar el archivo Excel: {{ excelError() }}
        </div>
      }

      @if (reportMode() === 'daily') {
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

      } @else {
        @if (weeklyLoading()) {
          <div class="rounded-2xl bg-white p-8 text-center text-sm text-outline">Cargando reporte semanal...</div>
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-xs">
              <span class="text-[10px] font-bold uppercase text-outline">Ventas recaudadas</span>
              <p class="mt-1 text-2xl font-extrabold text-emerald-700">{{ weeklySummary()?.grossSales | currencyCop: true }}</p>
              <p class="mt-1 text-xs text-outline">{{ weeklySummary()?.paidOrdersCount }} comandas pagadas</p>
            </div>
            <div class="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-xs">
              <span class="text-[10px] font-bold uppercase text-outline">Gastos de proveedores</span>
              <p class="mt-1 text-2xl font-extrabold text-rose-700">{{ weeklySummary()?.supplierExpensesTotal | currencyCop: true }}</p>
              <p class="mt-1 text-xs text-outline">Separados del arqueo diario de caja</p>
            </div>
            <div class="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-xs">
              <span class="text-[10px] font-bold uppercase text-outline">Resultado semanal</span>
              <p class="mt-1 text-2xl font-extrabold" [ngClass]="(weeklySummary()?.netAfterSupplierExpenses || 0) >= 0 ? 'text-primary' : 'text-rose-700'">
                {{ weeklySummary()?.netAfterSupplierExpenses | currencyCop: true }}
              </p>
              <p class="mt-1 text-xs text-outline">Ventas menos gastos de proveedores</p>
            </div>
            <div class="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-xs">
              <span class="text-[10px] font-bold uppercase text-outline">Comandas de la semana</span>
              <p class="mt-1 text-2xl font-extrabold text-primary">{{ weeklySummary()?.totalOrders }}</p>
              <p class="mt-1 text-xs text-outline">{{ formatWeekRange(weeklySummary()) }}</p>
            </div>
          </div>

          <section class="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-xs space-y-4">
            <div>
              <h3 class="text-sm font-bold text-primary">Ventas y gastos por día</h3>
              <p class="mt-1 text-[11px] text-outline">Ingresos según pagos recibidos. Los gastos de proveedores no afectan la caja diaria.</p>
            </div>
            @for (day of weeklySummary()?.days || []; track day.date) {
              <div class="grid grid-cols-[72px_1fr] sm:grid-cols-[90px_1fr] gap-3 items-center">
                <span class="text-[11px] font-bold capitalize text-on-surface">{{ day.label }}</span>
                <div class="space-y-1.5">
                  <div class="flex items-center gap-2">
                    <span class="w-14 text-right text-[9px] font-semibold text-emerald-700">Ventas</span>
                    <div class="h-3 flex-1 overflow-hidden rounded-full bg-surface-container">
                      <div class="h-full rounded-full bg-emerald-500 transition-all" [style.width.%]="barWidth(day.sales, 'sales')"></div>
                    </div>
                    <span class="w-24 text-right text-[10px] font-semibold text-on-surface">{{ day.sales | currencyCop }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="w-14 text-right text-[9px] font-semibold text-rose-700">Gastos</span>
                    <div class="h-3 flex-1 overflow-hidden rounded-full bg-surface-container">
                      <div class="h-full rounded-full bg-rose-400 transition-all" [style.width.%]="barWidth(day.supplierExpenses, 'expenses')"></div>
                    </div>
                    <span class="w-24 text-right text-[10px] font-semibold text-on-surface">{{ day.supplierExpenses | currencyCop }}</span>
                  </div>
                </div>
              </div>
            }
          </section>

          <section class="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-xs space-y-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 class="text-sm font-bold text-primary">Gastos de proveedores</h3>
                <p class="mt-1 text-[11px] text-outline">Se guardan en un registro semanal aparte y no se descuentan del efectivo de caja.</p>
              </div>
            </div>

            <form (ngSubmit)="addSupplierExpense()" class="grid grid-cols-1 gap-3 rounded-xl bg-surface-container-low p-3 sm:grid-cols-2 lg:grid-cols-5">
              <label class="text-[10px] font-bold text-on-surface">
                Proveedor
                <input type="text" [(ngModel)]="supplierName" name="supplierName" required maxlength="120" placeholder="Nombre del proveedor"
                  class="mt-1 w-full rounded-lg border border-outline-variant bg-white p-2 text-xs font-normal outline-none focus:border-primary-container" />
              </label>
              <label class="text-[10px] font-bold text-on-surface sm:col-span-2">
                Detalle
                <input type="text" [(ngModel)]="supplierDescription" name="supplierDescription" required maxlength="240" placeholder="Ej. Compra de pulpa de fruta"
                  class="mt-1 w-full rounded-lg border border-outline-variant bg-white p-2 text-xs font-normal outline-none focus:border-primary-container" />
              </label>
              <label class="text-[10px] font-bold text-on-surface">
                Valor (COP)
                <input type="number" [(ngModel)]="supplierAmount" name="supplierAmount" required min="1" step="100" placeholder="0"
                  class="mt-1 w-full rounded-lg border border-outline-variant bg-white p-2 text-xs font-normal outline-none focus:border-primary-container" />
              </label>
              <label class="text-[10px] font-bold text-on-surface">
                Fecha
                <input type="date" [(ngModel)]="supplierExpenseDate" name="supplierExpenseDate" required [min]="weeklySummary()?.weekStart" [max]="weeklySummary()?.weekEnd"
                  class="mt-1 w-full rounded-lg border border-outline-variant bg-white p-2 text-xs font-normal outline-none focus:border-primary-container" />
              </label>
              <button type="submit" [disabled]="savingExpense()" class="rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-white hover:bg-primary disabled:opacity-50 sm:col-start-2 lg:col-start-5">
                {{ savingExpense() ? 'Guardando...' : 'Registrar gasto' }}
              </button>
            </form>

            @if ((weeklySummary()?.supplierExpenses?.length || 0) > 0) {
              <div class="overflow-x-auto">
                <table class="w-full min-w-[560px] text-left text-xs">
                  <thead class="border-b border-outline-variant/40 text-[10px] uppercase text-outline">
                    <tr><th class="p-2">Fecha</th><th class="p-2">Proveedor</th><th class="p-2">Detalle</th><th class="p-2 text-right">Valor</th></tr>
                  </thead>
                  <tbody class="divide-y divide-outline-variant/20">
                    @for (expense of weeklySummary()?.supplierExpenses || []; track expense.id) {
                      <tr>
                        <td class="p-2 text-on-surface-variant">{{ expense.expense_date }}</td>
                        <td class="p-2 font-semibold text-on-surface">{{ expense.supplier_name }}</td>
                        <td class="p-2 text-on-surface-variant">{{ expense.description }}</td>
                        <td class="p-2 text-right font-bold text-rose-700">{{ expense.amount | currencyCop }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="rounded-lg bg-surface-container-low p-4 text-center text-xs text-outline">No hay gastos de proveedores registrados esta semana.</p>
            }
          </section>
        }
      }

    </div>
  `,
})
export class AdminReportsComponent implements OnInit {
  private readonly reportService = inject(ReportService);

  readonly reportMode = signal<'daily' | 'weekly'>('daily');
  readonly dailyLoading = signal(false);
  readonly weeklyLoading = signal(false);
  readonly savingExpense = signal(false);
  readonly exportingExcel = signal(false);
  readonly dailyError = signal('');
  readonly weeklyError = signal('');
  readonly excelError = signal('');
  selectedDate = this.todayInBogota();
  selectedWeek = this.getMonday(this.selectedDate);
  supplierName = '';
  supplierDescription = '';
  supplierAmount = 0;
  supplierExpenseDate = this.selectedDate;
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
  readonly weeklySummary = signal<WeeklyReportSummary | null>(null);

  async ngOnInit(): Promise<void> {
    await this.fetchReports();
  }

  selectReport(mode: 'daily' | 'weekly'): void {
    this.reportMode.set(mode);
    if (mode === 'weekly') void this.fetchWeeklyReport();
  }

  async fetchReports(): Promise<void> {
    this.dailyLoading.set(true);
    this.dailyError.set('');
    try {
      const data = await this.reportService.getReportData(this.selectedDate);
      this.summary.set(data);
    } catch (error) {
      console.error('Error cargando el reporte diario:', error);
      this.dailyError.set(error instanceof Error ? error.message : 'Error inesperado al consultar Supabase.');
    } finally {
      this.dailyLoading.set(false);
    }
  }

  async fetchWeeklyReport(): Promise<void> {
    this.selectedWeek = this.getMonday(this.selectedWeek || this.todayInBogota());
    this.weeklyLoading.set(true);
    this.weeklyError.set('');
    try {
      const report = await this.reportService.getWeeklyReportData(this.selectedWeek);
      this.weeklySummary.set(report);
      if (this.supplierExpenseDate < report.weekStart || this.supplierExpenseDate > report.weekEnd) {
        this.supplierExpenseDate = this.todayInBogota() >= report.weekStart && this.todayInBogota() <= report.weekEnd
          ? this.todayInBogota()
          : report.weekStart;
      }
    } catch (error) {
      console.error('Error cargando el reporte semanal:', error);
      this.weeklyError.set(error instanceof Error ? error.message : 'Error inesperado al consultar Supabase.');
    } finally {
      this.weeklyLoading.set(false);
    }
  }

  async addSupplierExpense(): Promise<void> {
    const report = this.weeklySummary();
    if (!report || this.savingExpense()) return;
    if (this.supplierExpenseDate < report.weekStart || this.supplierExpenseDate > report.weekEnd) {
      this.weeklyError.set('La fecha del gasto debe estar dentro de la semana seleccionada.');
      return;
    }

    this.savingExpense.set(true);
    this.weeklyError.set('');
    try {
      await this.reportService.addSupplierExpense({
        supplierName: this.supplierName,
        description: this.supplierDescription,
        amount: Number(this.supplierAmount),
        expenseDate: this.supplierExpenseDate,
      });
      this.supplierName = '';
      this.supplierDescription = '';
      this.supplierAmount = 0;
      await this.fetchWeeklyReport();
    } catch (error) {
      console.error('Error registrando gasto de proveedor:', error);
      this.weeklyError.set(error instanceof Error ? error.message : 'No se pudo guardar el gasto del proveedor.');
    } finally {
      this.savingExpense.set(false);
    }
  }

  async downloadWeeklyExcel(): Promise<void> {
    const report = this.weeklySummary();
    if (!report || this.exportingExcel()) return;

    this.exportingExcel.set(true);
    this.excelError.set('');
    try {
      const exceljs = await import('exceljs');
      const workbook = new exceljs.default.Workbook();
      workbook.creator = 'Candy El Progreso';
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.subject = 'Reporte semanal de ventas y gastos de proveedores';
      workbook.title = `Reporte semanal ${report.weekStart} al ${report.weekEnd}`;

      const summarySheet = workbook.addWorksheet('Resumen', {
        properties: { tabColor: { argb: 'FF166534' } },
        views: [{ state: 'frozen', ySplit: 4 }],
      });
      this.addExcelTitle(summarySheet, 'REPORTE SEMANAL', `Periodo: ${report.weekStart} al ${report.weekEnd}`, 2);
      summarySheet.columns = [{ width: 38 }, { width: 24 }];
      summarySheet.addRow([]);
      summarySheet.addRow(['Indicador', 'Resultado']);
      this.styleExcelHeader(summarySheet, 4, 2);
      [
        ['Ventas recaudadas', report.grossSales],
        ['Gastos de proveedores', report.supplierExpensesTotal],
        ['Resultado (ventas - gastos)', report.netAfterSupplierExpenses],
        ['Comandas pagadas', report.paidOrdersCount],
        ['Total de comandas', report.totalOrders],
      ].forEach(([label, value]) => summarySheet.addRow([label, value]));
      for (let row = 5; row <= 9; row++) {
        summarySheet.getCell(row, 1).font = { color: { argb: 'FF334155' } };
        summarySheet.getCell(row, 2).font = { bold: true, color: { argb: row === 7 ? 'FF166534' : 'FF0F172A' } };
        summarySheet.getCell(row, 2).numFmt = row >= 8 ? '0' : '"$"#,##0;[Red]-"$"#,##0';
      }
      summarySheet.autoFilter = 'A4:B9';

      const dailySheet = workbook.addWorksheet('Ventas diarias', {
        properties: { tabColor: { argb: 'FF059669' } },
        views: [{ state: 'frozen', ySplit: 4 }],
      });
      this.addExcelTitle(dailySheet, 'VENTAS Y GASTOS POR DÍA', `Periodo: ${report.weekStart} al ${report.weekEnd}`, 5);
      dailySheet.columns = [
        { header: 'Fecha', key: 'date', width: 16 },
        { header: 'Día', key: 'day', width: 18 },
        { header: 'Ventas recaudadas (COP)', key: 'sales', width: 25 },
        { header: 'Gastos proveedores (COP)', key: 'expenses', width: 26 },
        { header: 'Resultado diario (COP)', key: 'net', width: 25 },
      ];
      dailySheet.addRow([]);
      dailySheet.addRow(dailySheet.columns.map((column) => column.header));
      this.styleExcelHeader(dailySheet, 4, 5);
      report.days.forEach((day) => {
        dailySheet.addRow([
          new Date(`${day.date}T12:00:00.000Z`),
          day.label,
          day.sales,
          day.supplierExpenses,
          day.sales - day.supplierExpenses,
        ]);
      });
      dailySheet.addRow(['', 'TOTAL SEMANAL', report.grossSales, report.supplierExpensesTotal, report.netAfterSupplierExpenses]);
      for (let row = 5; row <= 12; row++) {
        dailySheet.getCell(row, 1).numFmt = 'dd/mm/yyyy';
        for (let column = 3; column <= 5; column++) {
          dailySheet.getCell(row, column).numFmt = '"$"#,##0;[Red]-"$"#,##0';
        }
      }
      this.styleExcelTotal(dailySheet, 12, 5);
      dailySheet.autoFilter = 'A4:E11';

      const expensesSheet = workbook.addWorksheet('Gastos proveedores', {
        properties: { tabColor: { argb: 'FFDC2626' } },
        views: [{ state: 'frozen', ySplit: 4 }],
      });
      this.addExcelTitle(expensesSheet, 'DETALLE DE GASTOS DE PROVEEDORES', `Periodo: ${report.weekStart} al ${report.weekEnd}`, 4);
      expensesSheet.columns = [
        { header: 'Fecha', key: 'date', width: 16 },
        { header: 'Proveedor', key: 'supplier', width: 28 },
        { header: 'Detalle', key: 'description', width: 52 },
        { header: 'Valor (COP)', key: 'amount', width: 22 },
      ];
      expensesSheet.addRow([]);
      expensesSheet.addRow(expensesSheet.columns.map((column) => column.header));
      this.styleExcelHeader(expensesSheet, 4, 4);
      report.supplierExpenses.forEach((expense) => {
        expensesSheet.addRow([
          new Date(`${expense.expense_date}T12:00:00.000Z`),
          expense.supplier_name,
          expense.description,
          expense.amount,
        ]);
      });
      const expenseTotalRow = expensesSheet.rowCount + 1;
      expensesSheet.addRow(['', '', 'TOTAL DE GASTOS', report.supplierExpensesTotal]);
      for (let row = 5; row < expenseTotalRow; row++) {
        expensesSheet.getCell(row, 1).numFmt = 'dd/mm/yyyy';
        expensesSheet.getCell(row, 4).numFmt = '"$"#,##0;[Red]-"$"#,##0';
      }
      expensesSheet.getCell(expenseTotalRow, 4).numFmt = '"$"#,##0;[Red]-"$"#,##0';
      this.styleExcelTotal(expensesSheet, expenseTotalRow, 4);
      if (report.supplierExpenses.length) {
        expensesSheet.autoFilter = `A4:D${expenseTotalRow - 1}`;
      }

      const paymentsSheet = workbook.addWorksheet('Métodos de pago', {
        properties: { tabColor: { argb: 'FF2563EB' } },
        views: [{ state: 'frozen', ySplit: 4 }],
      });
      this.addExcelTitle(paymentsSheet, 'VENTAS POR MÉTODO DE PAGO', `Periodo: ${report.weekStart} al ${report.weekEnd}`, 4);
      paymentsSheet.columns = [
        { header: 'Método de pago', key: 'method', width: 30 },
        { header: 'Cantidad de pagos', key: 'count', width: 22 },
        { header: 'Total recaudado (COP)', key: 'total', width: 26 },
        { header: 'Participación', key: 'percentage', width: 18 },
      ];
      paymentsSheet.addRow([]);
      paymentsSheet.addRow(paymentsSheet.columns.map((column) => column.header));
      this.styleExcelHeader(paymentsSheet, 4, 4);
      report.paymentMethods.forEach((method) => {
        paymentsSheet.addRow([method.label, method.count, method.total, method.percentage / 100]);
      });
      report.paymentMethods.forEach((_method, index) => {
        const row = index + 5;
        paymentsSheet.getCell(row, 3).numFmt = '"$"#,##0;[Red]-"$"#,##0';
        paymentsSheet.getCell(row, 4).numFmt = '0.0%';
      });
      if (report.paymentMethods.length) {
        paymentsSheet.autoFilter = `A4:D${paymentsSheet.rowCount}`;
      }

      const productsSheet = workbook.addWorksheet('Productos más vendidos', {
        properties: { tabColor: { argb: 'FFF59E0B' } },
        views: [{ state: 'frozen', ySplit: 4 }],
      });
      this.addExcelTitle(productsSheet, 'PRODUCTOS MÁS VENDIDOS', `Periodo: ${report.weekStart} al ${report.weekEnd}`, 3);
      productsSheet.columns = [
        { header: 'Producto', key: 'product', width: 42 },
        { header: 'Unidades vendidas', key: 'quantity', width: 22 },
        { header: 'Ventas (COP)', key: 'total', width: 24 },
      ];
      productsSheet.addRow([]);
      productsSheet.addRow(productsSheet.columns.map((column) => column.header));
      this.styleExcelHeader(productsSheet, 4, 3);
      report.topProducts.forEach((product) => {
        productsSheet.addRow([product.productName, product.quantity, product.total]);
      });
      report.topProducts.forEach((_product, index) => {
        productsSheet.getCell(index + 5, 3).numFmt = '"$"#,##0;[Red]-"$"#,##0';
      });
      if (report.topProducts.length) {
        productsSheet.autoFilter = `A4:C${productsSheet.rowCount}`;
      }

      const data = await workbook.xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(data)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-semanal-${report.weekStart}-${report.weekEnd}.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Error generando el Excel semanal:', error);
      this.excelError.set(error instanceof Error ? error.message : 'No se pudo generar el archivo Excel.');
    } finally {
      this.exportingExcel.set(false);
    }
  }

  private addExcelTitle(sheet: Worksheet, title: string, subtitle: string, lastColumn: number): void {
    sheet.mergeCells(1, 1, 1, lastColumn);
    sheet.mergeCells(2, 1, 2, lastColumn);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 32;
    const subtitleCell = sheet.getCell(2, 1);
    subtitleCell.value = subtitle;
    subtitleCell.font = { italic: true, color: { argb: 'FF475569' } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    sheet.getRow(2).height = 23;
  }

  private styleExcelHeader(sheet: Worksheet, rowNumber: number, columnCount: number): void {
    const row = sheet.getRow(rowNumber);
    row.height = 25;
    for (let column = 1; column <= columnCount; column++) {
      const cell = row.getCell(column);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    }
  }

  private styleExcelTotal(sheet: Worksheet, rowNumber: number, columnCount: number): void {
    const row = sheet.getRow(rowNumber);
    row.height = 24;
    for (let column = 1; column <= columnCount; column++) {
      const cell = row.getCell(column);
      cell.font = { bold: true, color: { argb: 'FF14532D' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      cell.border = { top: { style: 'thin', color: { argb: 'FF86EFAC' } } };
    }
  }

  barWidth(value: number, metric: 'sales' | 'expenses'): number {
    const days = this.weeklySummary()?.days || [];
    const max = Math.max(
      0,
      ...days.map((day) => metric === 'sales' ? day.sales : day.supplierExpenses)
    );
    return max > 0 ? (value / max) * 100 : 0;
  }

  formatWeekRange(report: WeeklyReportSummary | null): string {
    if (!report) return '';
    return `${report.weekStart} al ${report.weekEnd}`;
  }

  private todayInBogota(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: string): string => parts.find((item) => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private getMonday(date: string): string {
    const parsed = new Date(`${date}T12:00:00.000Z`);
    parsed.setUTCDate(parsed.getUTCDate() - ((parsed.getUTCDay() + 6) % 7));
    return parsed.toISOString().slice(0, 10);
  }
}
