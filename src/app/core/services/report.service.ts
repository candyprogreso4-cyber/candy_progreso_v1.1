import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

export interface DailyReportSummary {
  grossSales: number;
  totalOrders: number;
  averageTicket: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  paymentMethods: {
    method: string;
    label: string;
    total: number;
    count: number;
    percentage: number;
  }[];
  topProducts: {
    productName: string;
    quantity: number;
    total: number;
  }[];
  employeeSales: {
    employeeName: string;
    ordersCount: number;
    total: number;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly supabase = inject(SupabaseClientService).instance;

  async getReportData(dateStr?: string): Promise<DailyReportSummary> {
    try {
      const selectedDate = dateStr || new Date().toISOString().split('T')[0];
      const startOfDay = `${selectedDate}T00:00:00Z`;
      const endOfDay = `${selectedDate}T23:59:59Z`;

      // 1. Obtener pedidos del rango
      const { data: orders, error: ordersError } = await this.supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, total, created_at,
          employee:employees(full_name),
          items:order_items(product_name, quantity, subtotal)
        `)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

      if (ordersError) throw ordersError;

      // 2. Obtener pagos del rango
      const { data: payments, error: payError } = await this.supabase
        .from('payments')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

      if (payError) throw payError;

      const orderList = orders || [];
      const paymentList = payments || [];

      // Cálculos agregados
      const paidOrders = orderList.filter((o) => o.payment_status === 'paid');
      const pendingOrders = orderList.filter((o) => o.payment_status === 'pending' && o.status !== 'cancelled');
      const cancelledOrders = orderList.filter((o) => o.status === 'cancelled');

      const grossSales = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const totalOrders = orderList.length;
      const averageTicket = paidOrders.length > 0 ? grossSales / paidOrders.length : 0;

      // Desglose de métodos de pago
      const methodLabels: Record<string, string> = {
        cash: 'Efectivo',
        nequi: 'Nequi (QR)',
        daviplata: 'Daviplata',
        transfer: 'Transferencia Bancaria',
        other: 'Datáfono / Tarjeta',
      };

      const methodTotals: Record<string, { total: number; count: number }> = {
        cash: { total: 0, count: 0 },
        nequi: { total: 0, count: 0 },
        daviplata: { total: 0, count: 0 },
        other: { total: 0, count: 0 },
        transfer: { total: 0, count: 0 },
      };

      paymentList.forEach((p) => {
        const m = p.payment_method || 'cash';
        if (!methodTotals[m]) methodTotals[m] = { total: 0, count: 0 };
        methodTotals[m].total += Number(p.amount || 0);
        methodTotals[m].count += 1;
      });

      const totalPaymentsSum = paymentList.reduce((s, p) => s + Number(p.amount || 0), 0);

      const paymentMethods = Object.keys(methodTotals).map((key) => ({
        method: key,
        label: methodLabels[key] || key.toUpperCase(),
        total: methodTotals[key].total,
        count: methodTotals[key].count,
        percentage: totalPaymentsSum > 0 ? (methodTotals[key].total / totalPaymentsSum) * 100 : 0,
      }));

      // Productos más vendidos
      const productMap: Record<string, { quantity: number; total: number }> = {};
      orderList.forEach((o: any) => {
        if (o.status !== 'cancelled') {
          (o.items || []).forEach((it: any) => {
            const name = it.product_name || 'Desconocido';
            if (!productMap[name]) productMap[name] = { quantity: 0, total: 0 };
            productMap[name].quantity += Number(it.quantity || 1);
            productMap[name].total += Number(it.subtotal || 0);
          });
        }
      });

      const topProducts = Object.keys(productMap)
        .map((name) => ({
          productName: name,
          quantity: productMap[name].quantity,
          total: productMap[name].total,
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Ventas por empleado
      const empMap: Record<string, { count: number; total: number }> = {};
      orderList.forEach((o: any) => {
        const empName = o.employee?.full_name || 'Sin Asignar';
        if (!empMap[empName]) empMap[empName] = { count: 0, total: 0 };
        empMap[empName].count += 1;
        if (o.payment_status === 'paid') {
          empMap[empName].total += Number(o.total || 0);
        }
      });

      const employeeSales = Object.keys(empMap).map((name) => ({
        employeeName: name,
        ordersCount: empMap[name].count,
        total: empMap[name].total,
      })).sort((a, b) => b.total - a.total);

      return {
        grossSales,
        totalOrders,
        averageTicket,
        paidOrdersCount: paidOrders.length,
        pendingOrdersCount: pendingOrders.length,
        cancelledOrdersCount: cancelledOrders.length,
        paymentMethods,
        topProducts,
        employeeSales,
      };
    } catch (err) {
      console.warn('Error al generar resumen de reportes:', err);
      return {
        grossSales: 0,
        totalOrders: 0,
        averageTicket: 0,
        paidOrdersCount: 0,
        pendingOrdersCount: 0,
        cancelledOrdersCount: 0,
        paymentMethods: [],
        topProducts: [],
        employeeSales: [],
      };
    }
  }
}
