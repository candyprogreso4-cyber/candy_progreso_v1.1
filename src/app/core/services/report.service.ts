import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

export interface PaymentMethodSummary {
  method: string;
  label: string;
  total: number;
  count: number;
  percentage: number;
}

export interface TopProductSummary {
  productName: string;
  quantity: number;
  total: number;
}

export interface DailyReportSummary {
  grossSales: number;
  totalOrders: number;
  averageTicket: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  paymentMethods: PaymentMethodSummary[];
  topProducts: TopProductSummary[];
  employeeSales: {
    employeeName: string;
    ordersCount: number;
    total: number;
  }[];
}

export interface SupplierExpense {
  id: string;
  supplier_name: string;
  description: string;
  amount: number;
  expense_date: string;
  created_at: string;
}

export interface WeeklyReportDay {
  date: string;
  label: string;
  sales: number;
  supplierExpenses: number;
}

export interface WeeklyReportSummary {
  weekStart: string;
  weekEnd: string;
  grossSales: number;
  supplierExpensesTotal: number;
  netAfterSupplierExpenses: number;
  paidOrdersCount: number;
  totalOrders: number;
  paymentMethods: PaymentMethodSummary[];
  topProducts: TopProductSummary[];
  days: WeeklyReportDay[];
  supplierExpenses: SupplierExpense[];
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  nequi: 'Nequi (QR)',
  daviplata: 'Daviplata',
  transfer: 'Transferencia Bancaria',
  other: 'Datáfono / Tarjeta',
};

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly supabase = inject(SupabaseClientService).instance;

  async getReportData(dateStr = this.getTodayInBogota()): Promise<DailyReportSummary> {
    const nextDay = this.addDays(dateStr, 1);
    const { start, end } = this.timestampRange(dateStr, nextDay);

    const [{ data: orders, error: ordersError }, { data: payments, error: paymentsError }] =
      await Promise.all([
        this.supabase
          .from('orders')
          .select(`
            id, order_number, status, payment_status, total, created_at,
            employee:employees(full_name),
            items:order_items(product_name, quantity, subtotal)
          `)
          .gte('created_at', start)
          .lt('created_at', end),
        this.supabase
          .from('payments')
          .select('order_id, amount, payment_method, created_at')
          .gte('created_at', start)
          .lt('created_at', end),
      ]);

    if (ordersError) throw ordersError;
    if (paymentsError) throw paymentsError;

    const orderList = orders || [];
    const paymentList = payments || [];
    const paidOrderIds = new Set(paymentList.map((payment) => payment.order_id));
    const pendingOrders = orderList.filter(
      (order) => order.payment_status === 'pending' && order.status !== 'cancelled'
    );
    const cancelledOrders = orderList.filter((order) => order.status === 'cancelled');
    const grossSales = paymentList.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      grossSales,
      totalOrders: orderList.length,
      averageTicket: paidOrderIds.size > 0 ? grossSales / paidOrderIds.size : 0,
      paidOrdersCount: paidOrderIds.size,
      pendingOrdersCount: pendingOrders.length,
      cancelledOrdersCount: cancelledOrders.length,
      paymentMethods: this.summarizePaymentMethods(paymentList),
      topProducts: this.summarizeProducts(orderList),
      employeeSales: this.summarizeEmployeeSales(orderList),
    };
  }

  async getWeeklyReportData(weekContaining = this.getTodayInBogota()): Promise<WeeklyReportSummary> {
    const weekStart = this.getMonday(weekContaining);
    const weekEndExclusive = this.addDays(weekStart, 7);
    const weekEnd = this.addDays(weekEndExclusive, -1);
    const { start, end } = this.timestampRange(weekStart, weekEndExclusive);

    const [
      { data: payments, error: paymentsError },
      { data: orders, error: ordersError },
      { data: expenses, error: expensesError },
    ] = await Promise.all([
      this.supabase
        .from('payments')
        .select('order_id, amount, payment_method, created_at')
        .gte('created_at', start)
        .lt('created_at', end),
      this.supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, total, created_at,
          employee:employees(full_name),
          items:order_items(product_name, quantity, subtotal)
        `)
        .gte('created_at', start)
        .lt('created_at', end),
      this.supabase
        .from('supplier_expenses')
        .select('id, supplier_name, description, amount, expense_date, created_at')
        .gte('expense_date', weekStart)
        .lte('expense_date', weekEnd)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);

    if (paymentsError) throw paymentsError;
    if (ordersError) throw ordersError;
    if (expensesError) throw expensesError;

    const paymentList = payments || [];
    const orderList = orders || [];
    const expenseList: SupplierExpense[] = (expenses || []).map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
    }));
    const grossSales = paymentList.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const supplierExpensesTotal = expenseList.reduce((sum, expense) => sum + expense.amount, 0);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = this.addDays(weekStart, index);
      return {
        date,
        label: this.formatWeekday(date),
        sales: 0,
        supplierExpenses: 0,
      };
    });
    const daysByDate = new Map(days.map((day) => [day.date, day]));

    paymentList.forEach((payment) => {
      const day = daysByDate.get(this.getBogotaDate(payment.created_at));
      if (day) day.sales += Number(payment.amount || 0);
    });
    expenseList.forEach((expense) => {
      const day = daysByDate.get(expense.expense_date);
      if (day) day.supplierExpenses += expense.amount;
    });

    return {
      weekStart,
      weekEnd,
      grossSales,
      supplierExpensesTotal,
      netAfterSupplierExpenses: grossSales - supplierExpensesTotal,
      paidOrdersCount: new Set(paymentList.map((payment) => payment.order_id)).size,
      totalOrders: orderList.length,
      paymentMethods: this.summarizePaymentMethods(paymentList),
      topProducts: this.summarizeProducts(orderList),
      days,
      supplierExpenses: expenseList,
    };
  }

  async addSupplierExpense(expense: {
    supplierName: string;
    description: string;
    amount: number;
    expenseDate: string;
  }): Promise<void> {
    if (!expense.supplierName.trim() || !expense.description.trim()) {
      throw new Error('Ingresa el nombre del proveedor y el detalle del gasto.');
    }
    if (!Number.isFinite(expense.amount) || expense.amount <= 0) {
      throw new Error('El valor del gasto debe ser mayor a cero.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expense.expenseDate)) {
      throw new Error('Selecciona una fecha válida para el gasto.');
    }

    const { error } = await this.supabase.from('supplier_expenses').insert({
      supplier_name: expense.supplierName.trim(),
      description: expense.description.trim(),
      amount: expense.amount,
      expense_date: expense.expenseDate,
    });
    if (error) throw error;
  }

  async getSupplierExpenses(startDate: string, endDate: string): Promise<SupplierExpense[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
      throw new Error('El rango de fechas para consultar gastos no es válido.');
    }

    const { data, error } = await this.supabase
      .from('supplier_expenses')
      .select('id, supplier_name, description, amount, expense_date, created_at')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
    }));
  }

  private summarizePaymentMethods(payments: any[]): PaymentMethodSummary[] {
    const totals = new Map<string, { total: number; count: number }>();
    payments.forEach((payment) => {
      const method = payment.payment_method || 'cash';
      const current = totals.get(method) || { total: 0, count: 0 };
      current.total += Number(payment.amount || 0);
      current.count += 1;
      totals.set(method, current);
    });

    const totalPayments = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return [...totals.entries()]
      .map(([method, totalsForMethod]) => ({
        method,
        label: PAYMENT_METHOD_LABELS[method] || method.toUpperCase(),
        total: totalsForMethod.total,
        count: totalsForMethod.count,
        percentage: totalPayments > 0 ? (totalsForMethod.total / totalPayments) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  private summarizeProducts(orders: any[]): TopProductSummary[] {
    const productTotals = new Map<string, { quantity: number; total: number }>();
    orders.forEach((order) => {
      if (order.status === 'cancelled' || order.payment_status !== 'paid') return;
      (order.items || []).forEach((item: any) => {
        const name = item.product_name || 'Desconocido';
        const current = productTotals.get(name) || { quantity: 0, total: 0 };
        current.quantity += Number(item.quantity || 1);
        current.total += Number(item.subtotal || 0);
        productTotals.set(name, current);
      });
    });

    return [...productTotals.entries()]
      .map(([productName, totals]) => ({ productName, ...totals }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }

  private summarizeEmployeeSales(orders: any[]): DailyReportSummary['employeeSales'] {
    const totals = new Map<string, { ordersCount: number; total: number }>();
    orders.forEach((order) => {
      const name = order.employee?.full_name || 'Sin Asignar';
      const current = totals.get(name) || { ordersCount: 0, total: 0 };
      current.ordersCount += 1;
      if (order.payment_status === 'paid') current.total += Number(order.total || 0);
      totals.set(name, current);
    });

    return [...totals.entries()]
      .map(([employeeName, summary]) => ({ employeeName, ...summary }))
      .sort((a, b) => b.total - a.total);
  }

  private timestampRange(startDate: string, endDate: string): { start: string; end: string } {
    return {
      start: `${startDate}T05:00:00.000Z`,
      end: `${endDate}T05:00:00.000Z`,
    };
  }

  private getTodayInBogota(): string {
    return this.getBogotaDate(new Date().toISOString());
  }

  private getBogotaDate(timestamp: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(timestamp));
    const part = (type: string): string => parts.find((item) => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private getMonday(date: string): string {
    const parsedDate = new Date(`${date}T12:00:00.000Z`);
    const daysSinceMonday = (parsedDate.getUTCDay() + 6) % 7;
    parsedDate.setUTCDate(parsedDate.getUTCDate() - daysSinceMonday);
    return parsedDate.toISOString().slice(0, 10);
  }

  private addDays(date: string, amount: number): string {
    const parsedDate = new Date(`${date}T12:00:00.000Z`);
    parsedDate.setUTCDate(parsedDate.getUTCDate() + amount);
    return parsedDate.toISOString().slice(0, 10);
  }

  private formatWeekday(date: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'UTC',
      weekday: 'short',
      day: '2-digit',
    }).format(new Date(`${date}T12:00:00.000Z`));
  }
}
