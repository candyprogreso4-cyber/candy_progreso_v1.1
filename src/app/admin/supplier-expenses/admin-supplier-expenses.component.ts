import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';
import { ReportService, SupplierExpense } from '../../core/services/report.service';

@Component({
  selector: 'app-admin-supplier-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyCopPipe],
  template: `
    <div class="space-y-6">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-xl font-bold text-primary">Gastos de Proveedores</h1>
          <p class="mt-1 text-xs text-on-surface-variant">
            Registra y consulta compras semanales. Estos gastos no se descuentan del arqueo diario de caja.
          </p>
        </div>
        <label class="flex items-center gap-2 self-start rounded-xl border border-outline-variant/40 bg-white p-2 shadow-xs">
          <span class="material-symbols-outlined text-sm text-outline">date_range</span>
          <span class="text-[10px] font-bold text-outline">Semana de</span>
          <input
            type="date"
            [(ngModel)]="weekDate"
            (change)="loadExpenses()"
            class="bg-transparent text-xs font-bold text-primary outline-none"
          />
        </label>
      </header>

      @if (error()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800" role="alert">
          <p>{{ error() }}</p>
          <button type="button" (click)="loadExpenses()" class="mt-2 font-bold underline">Reintentar</button>
        </div>
      }

      <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-xs">
          <p class="text-[10px] font-bold uppercase text-outline">Total de la semana</p>
          <p class="mt-1 text-2xl font-extrabold text-rose-700">{{ totalExpenses() | currencyCop: true }}</p>
          <p class="mt-1 text-xs text-outline">{{ expenses().length }} gastos registrados</p>
        </div>
        <div class="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-xs sm:col-span-2">
          <p class="text-[10px] font-bold uppercase text-outline">Semana seleccionada</p>
          <p class="mt-1 text-lg font-bold text-primary">{{ weekStart() }} al {{ weekEnd() }}</p>
          <p class="mt-1 text-xs text-on-surface-variant">El período se calcula de lunes a domingo, hora de Colombia.</p>
        </div>
      </section>

      <section class="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-xs">
        <div class="mb-4">
          <h2 class="text-sm font-bold text-primary">Registrar gasto de proveedor</h2>
          <p class="mt-1 text-[11px] text-outline">Este registro es independiente de los egresos menores de caja.</p>
        </div>

        <form (ngSubmit)="addExpense()" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label class="text-[10px] font-bold text-on-surface">
            Proveedor
            <input
              type="text"
              [(ngModel)]="supplierName"
              name="supplierName"
              required
              maxlength="120"
              placeholder="Nombre del proveedor"
              class="mt-1 w-full rounded-lg border border-outline-variant p-2.5 text-xs font-normal outline-none focus:border-primary-container"
            />
          </label>
          <label class="text-[10px] font-bold text-on-surface sm:col-span-2">
            Detalle de compra
            <input
              type="text"
              [(ngModel)]="description"
              name="description"
              required
              maxlength="240"
              placeholder="Ej. Compra de pulpa de fruta"
              class="mt-1 w-full rounded-lg border border-outline-variant p-2.5 text-xs font-normal outline-none focus:border-primary-container"
            />
          </label>
          <label class="text-[10px] font-bold text-on-surface">
            Valor (COP)
            <input
              type="number"
              [(ngModel)]="amount"
              name="amount"
              required
              min="1"
              step="100"
              placeholder="0"
              class="mt-1 w-full rounded-lg border border-outline-variant p-2.5 text-xs font-normal outline-none focus:border-primary-container"
            />
          </label>
          <label class="text-[10px] font-bold text-on-surface">
            Fecha del gasto
            <input
              type="date"
              [(ngModel)]="expenseDate"
              name="expenseDate"
              required
              [min]="weekStart()"
              [max]="weekEnd()"
              class="mt-1 w-full rounded-lg border border-outline-variant p-2.5 text-xs font-normal outline-none focus:border-primary-container"
            />
          </label>
          <button
            type="submit"
            [disabled]="saving() || loading()"
            class="rounded-lg bg-primary-container px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 sm:col-start-2 lg:col-start-5"
          >
            {{ saving() ? 'Guardando...' : 'Registrar gasto' }}
          </button>
        </form>
      </section>

      <section class="overflow-hidden rounded-2xl border border-outline-variant/30 bg-white shadow-xs">
        <div class="flex items-center justify-between border-b border-outline-variant/20 px-5 py-4">
          <div>
            <h2 class="text-sm font-bold text-primary">Gastos registrados</h2>
            <p class="mt-1 text-[10px] text-outline">Lista correspondiente a la semana seleccionada</p>
          </div>
          <button
            type="button"
            (click)="loadExpenses()"
            [disabled]="loading()"
            class="flex items-center gap-1 rounded-lg border border-outline-variant/50 px-3 py-2 text-[10px] font-bold text-primary hover:bg-surface-container disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-sm">refresh</span>
            Actualizar
          </button>
        </div>

        @if (loading()) {
          <div class="p-8 text-center text-xs text-outline">Cargando gastos...</div>
        } @else if (expenses().length === 0) {
          <div class="p-8 text-center text-xs text-outline">Todavía no hay gastos registrados esta semana.</div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full min-w-[620px] text-left text-xs">
              <thead class="border-b border-outline-variant/30 bg-surface-container-low text-[10px] uppercase text-outline">
                <tr>
                  <th class="p-3">Fecha</th>
                  <th class="p-3">Proveedor</th>
                  <th class="p-3">Detalle</th>
                  <th class="p-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/20">
                @for (expense of expenses(); track expense.id) {
                  <tr>
                    <td class="whitespace-nowrap p-3 text-on-surface-variant">{{ expense.expense_date }}</td>
                    <td class="p-3 font-semibold text-on-surface">{{ expense.supplier_name }}</td>
                    <td class="p-3 text-on-surface-variant">{{ expense.description }}</td>
                    <td class="whitespace-nowrap p-3 text-right font-bold text-rose-700">{{ expense.amount | currencyCop }}</td>
                  </tr>
                }
              </tbody>
              <tfoot class="border-t border-outline-variant/30 bg-surface-container-low">
                <tr>
                  <td colspan="3" class="p-3 text-right text-[10px] font-bold uppercase text-on-surface">Total semanal</td>
                  <td class="whitespace-nowrap p-3 text-right font-extrabold text-rose-700">{{ totalExpenses() | currencyCop }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
      </section>
    </div>
  `,
})
export class AdminSupplierExpensesComponent implements OnInit {
  private readonly reportService = inject(ReportService);

  readonly expenses = signal<SupplierExpense[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly totalExpenses = computed(() =>
    this.expenses().reduce((total, expense) => total + expense.amount, 0)
  );

  weekDate = this.todayInBogota();
  supplierName = '';
  description = '';
  amount = 0;
  expenseDate = this.weekDate;

  weekStart(): string {
    const date = new Date(`${this.weekDate}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
  }

  weekEnd(): string {
    const date = new Date(`${this.weekStart()}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 6);
    return date.toISOString().slice(0, 10);
  }

  async ngOnInit(): Promise<void> {
    await this.loadExpenses();
  }

  async loadExpenses(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const start = this.weekStart();
    const end = this.weekEnd();
    if (this.expenseDate < start || this.expenseDate > end) {
      this.expenseDate = this.weekDate >= start && this.weekDate <= end ? this.weekDate : start;
    }

    try {
      this.expenses.set(await this.reportService.getSupplierExpenses(start, end));
    } catch (error) {
      console.error('Error cargando gastos de proveedores:', error);
      this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar los gastos.');
    } finally {
      this.loading.set(false);
    }
  }

  async addExpense(): Promise<void> {
    if (this.saving()) return;
    if (!this.supplierName.trim() || !this.description.trim() || !Number.isFinite(this.amount) || this.amount <= 0) {
      this.error.set('Completa proveedor, detalle y un valor mayor que cero.');
      return;
    }
    if (this.expenseDate < this.weekStart() || this.expenseDate > this.weekEnd()) {
      this.error.set('La fecha del gasto debe estar dentro de la semana seleccionada.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      await this.reportService.addSupplierExpense({
        supplierName: this.supplierName,
        description: this.description,
        amount: Number(this.amount),
        expenseDate: this.expenseDate,
      });
      this.supplierName = '';
      this.description = '';
      this.amount = 0;
      await this.loadExpenses();
    } catch (error) {
      console.error('Error registrando gasto de proveedor:', error);
      this.error.set(error instanceof Error ? error.message : 'No se pudo registrar el gasto.');
    } finally {
      this.saving.set(false);
    }
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
}
