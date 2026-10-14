import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CashService } from '../../core/services/cash.service';
import { OrderService } from '../../core/services/order.service';
import { ReportService, DailyReportSummary } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';

@Component({
  selector: 'app-admin-cash',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyCopPipe],
  template: `
    <div class="space-y-6">
      
      <!-- Top Title and Status -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-bold text-primary">Gestión de Caja &amp; Cierre de Jornada</h1>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold"
                  [ngClass]="cashService.currentRegister() ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'">
              {{ cashService.currentRegister() ? 'Caja Abierta' : 'Caja Cerrada' }}
            </span>
          </div>
          <p class="text-xs text-on-surface-variant mt-0.5">
            Arqueo de cajón físico, conciliación de recaudos y congelamiento de jornada
          </p>
        </div>

        <div class="flex gap-2">
          @if (!cashService.currentRegister()) {
            <button
              type="button"
              (click)="openRegisterModal.set(true)"
              class="px-4 py-2 bg-primary-container hover:bg-primary text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <span class="material-symbols-outlined text-sm">lock_open</span>
              <span>Abrir Turno de Caja</span>
            </button>
          } @else {
            <button
              type="button"
              (click)="openExpenseModal.set(true)"
              class="px-3.5 py-2 bg-white hover:bg-surface-container text-rose-700 text-xs font-bold rounded-xl border border-rose-200 flex items-center gap-1.5 transition-all shadow-xs"
            >
              <span class="material-symbols-outlined text-sm">remove_circle</span>
              <span>Registrar Egreso Menor</span>
            </button>
          }
        </div>
      </div>

      @if (reportError()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800" role="alert">
          No se pudieron cargar los totales de ventas: {{ reportError() }}
          <button type="button" (click)="loadReportData()" class="ml-2 font-bold underline">Reintentar</button>
        </div>
      }

      <!-- If no open register -->
      @if (!cashService.currentRegister() && !cashService.isLoading()) {
        <div class="bg-white rounded-2xl border border-outline-variant/30 p-8 text-center max-w-lg mx-auto shadow-xs space-y-4">
          <div class="w-16 h-16 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <span class="material-symbols-outlined text-3xl">lock</span>
          </div>
          <h2 class="text-lg font-bold text-primary">La caja de hoy está cerrada</h2>
          <p class="text-xs text-on-surface-variant leading-relaxed">
            Para registrar pedidos y transacciones con tranquilidad, abre el turno de caja indicando la base en efectivo con la que inicia la heladería.
          </p>
          <button
            type="button"
            (click)="openRegisterModal.set(true)"
            class="py-3 px-6 bg-primary-container hover:bg-primary text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
          >
            ABRIR CAJA CON BASE INICIAL
          </button>
        </div>
      }

      <!-- Main Open Register Section -->
      @if (cashService.currentRegister(); as reg) {
        
        <!-- 4 Top KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <!-- KPI 1: Base Inicial -->
          <div class="p-5 rounded-2xl bg-white border border-outline-variant/30 shadow-xs flex flex-col justify-between">
            <div class="flex items-center justify-between text-outline">
              <span class="text-[10px] font-bold uppercase tracking-wider">SALDO INICIAL (BASE)</span>
              <div class="w-8 h-8 rounded-lg bg-surface-container text-primary flex items-center justify-center">
                <span class="material-symbols-outlined text-base">savings</span>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl font-bold text-on-surface tracking-tight">
                {{ reg.opening_amount | currencyCop }}
              </div>
              <p class="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                <span class="material-symbols-outlined text-xs text-emerald-600">verified</span>
                <span>Base física al abrir turno</span>
              </p>
            </div>
          </div>

          <!-- KPI 2: Ventas Totales -->
          <div class="p-5 rounded-2xl bg-white border border-outline-variant/30 shadow-xs flex flex-col justify-between">
            <div class="flex items-center justify-between text-outline">
              <span class="text-[10px] font-bold uppercase tracking-wider">VENTAS TOTALES DEL DÍA</span>
              <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <span class="material-symbols-outlined text-base">trending_up</span>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl font-bold text-emerald-700 tracking-tight">
                {{ summary().grossSales | currencyCop }}
              </div>
              <p class="text-xs text-on-surface-variant mt-1">
                {{ summary().paidOrdersCount }} comandas liquidadas
              </p>
            </div>
          </div>

          <!-- KPI 3: Efectivo Esperado en Caja -->
          <div class="p-5 rounded-2xl bg-white border-2 border-primary-container/20 shadow-xs flex flex-col justify-between bg-gradient-to-br from-white to-surface-container-low">
            <div class="flex items-center justify-between text-outline">
              <span class="text-[10px] font-bold uppercase text-primary tracking-wider">EFECTIVO ESPERADO EN CAJA</span>
              <div class="w-8 h-8 rounded-lg bg-primary-container text-white flex items-center justify-center">
                <span class="material-symbols-outlined text-base">payments</span>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl font-bold text-primary tracking-tight">
                {{ expectedCash() | currencyCop: true }}
              </div>
              <p class="text-xs text-outline mt-1 truncate">
                Base + Ventas Efectivo - Egresos
              </p>
            </div>
          </div>

          <!-- KPI 4: Total Ingresos Digitales -->
          <div class="p-5 rounded-2xl bg-white border border-outline-variant/30 shadow-xs flex flex-col justify-between">
            <div class="flex items-center justify-between text-outline">
              <span class="text-[10px] font-bold uppercase tracking-wider">INGRESOS DIGITALES</span>
              <div class="w-8 h-8 rounded-lg bg-secondary-container/40 text-secondary flex items-center justify-center">
                <span class="material-symbols-outlined text-base">qr_code_scanner</span>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl font-bold text-secondary tracking-tight">
                {{ digitalSales() | currencyCop }}
              </div>
              <p class="text-xs text-outline mt-1">
                Nequi, Daviplata, Tarjetas &amp; Transf.
              </p>
            </div>
          </div>

        </div>

        <!-- Módulo 12: Desglose Detallado por Métodos de Pago -->
        <section class="p-5 rounded-2xl bg-white border border-outline-variant/30 shadow-xs space-y-4">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary-container">account_balance_wallet</span>
              <h3 class="text-sm font-bold text-primary">Desglose por Métodos de Pago</h3>
            </div>
            <span class="text-xs text-outline">Total Consolidado: <strong class="text-primary">{{ summary().grossSales | currencyCop: true }}</strong></span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            @for (method of summary().paymentMethods; track method.method) {
              <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
                <span class="text-[10px] font-bold uppercase text-outline">{{ method.label }}</span>
                <div class="text-base font-bold text-on-surface my-1.5">{{ method.total | currencyCop }}</div>
                <div class="text-[11px] text-outline flex justify-between">
                  <span>{{ method.count }} pedidos</span>
                  <span class="font-bold text-primary">{{ method.percentage | number:'1.0-1' }}%</span>
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Requerimiento Estricto: Alerta Naranja Previa al Cierre si hay pedidos pendientes -->
        @if (orderService.pendingPaymentOrders().length > 0) {
          <div class="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fade-in">
            <div class="flex items-start gap-3">
              <span class="material-symbols-outlined text-2xl text-amber-600 mt-0.5">warning</span>
              <div>
                <h4 class="text-sm font-bold text-amber-900">
                  Advertencia previa al cierre: Aún tienes {{ orderService.pendingPaymentOrders().length }} pedidos finalizados en "Pendientes de Cobro"
                </h4>
                <p class="text-xs text-amber-800 mt-0.5">
                  Debes cobrarlos o anularlos formalmente antes de congelar la jornada para evitar inconsistencias en el arqueo fiscal.
                </p>
              </div>
            </div>
            <a
              routerLink="/admin/payments"
              class="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs shrink-0 transition-all"
            >
              <span>Ver Pendientes</span>
              <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
          </div>
        }

        <!-- Panel Central Arqueo: Grid 2 Columnas Asimétrico -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <!-- Left Column: Resumen Operativo de Jornada (5 cols) -->
          <div class="lg:col-span-5 space-y-4">
            
            <div class="p-5 rounded-2xl bg-white border border-outline-variant/30 shadow-xs space-y-3">
              <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary">list_alt</span>
                  <h3 class="text-sm font-bold text-primary">Actividad de la Jornada</h3>
                </div>
                <span class="text-[10px] bg-surface-container px-2 py-0.5 rounded font-bold text-outline">T-01</span>
              </div>

              <div class="space-y-2 text-xs">
                <div class="flex justify-between p-2.5 rounded-xl bg-surface-container-low">
                  <span class="text-on-surface">Pedidos Realizados en Total</span>
                  <span class="font-bold text-primary">{{ summary().totalOrders }}</span>
                </div>
                <div class="flex justify-between p-2.5 rounded-xl bg-surface-container-low">
                  <span class="text-on-surface">Pedidos Despachados</span>
                  <span class="font-bold text-on-surface">{{ summary().paidOrdersCount + summary().pendingOrdersCount }}</span>
                </div>
                <div class="flex justify-between p-2.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200">
                  <span class="font-medium">Pedidos Pagados &amp; Cuadrados</span>
                  <span class="font-bold text-emerald-800">{{ summary().paidOrdersCount }}</span>
                </div>
                <div class="flex justify-between p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
                  <span class="font-medium">Pendientes de Cobro</span>
                  <span class="font-bold text-amber-800">{{ summary().pendingOrdersCount }}</span>
                </div>
              </div>
            </div>

            <!-- Movimientos de caja registrados (Egresos / Ingresos) -->
            <div class="p-5 rounded-2xl bg-white border border-outline-variant/30 shadow-xs space-y-3">
              <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
                <h3 class="text-sm font-bold text-primary">Movimientos de Caja Registrados</h3>
                <span class="text-xs text-outline">{{ cashService.movements().length }} registros</span>
              </div>

              <div class="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scroll text-xs">
                @for (mov of cashService.movements(); track mov.id) {
                  <div class="p-2.5 rounded-xl border flex items-center justify-between"
                       [ngClass]="mov.type === 'expense' ? 'bg-rose-50/60 border-rose-200' : 'bg-surface-container-low border-outline-variant/30'">
                    <div>
                      <p class="font-bold" [ngClass]="mov.type === 'expense' ? 'text-rose-800' : 'text-on-surface'">
                        {{ mov.description }}
                      </p>
                      <span class="text-[10px] text-outline uppercase">{{ mov.type }}</span>
                    </div>
                    <span class="font-bold text-sm" [ngClass]="mov.type === 'expense' ? 'text-rose-700' : 'text-emerald-700'">
                      {{ mov.type === 'expense' ? '-' : '+' }}{{ mov.amount | currencyCop }}
                    </span>
                  </div>
                }

                @if (cashService.movements().length === 0) {
                  <p class="text-center py-4 text-xs text-outline">Sin movimientos registrados.</p>
                }
              </div>
            </div>

            <!-- Notes field for day closure -->
            <div class="p-5 rounded-2xl bg-white border border-outline-variant/30 shadow-xs space-y-2">
              <label class="block text-xs font-bold text-primary">
                Observaciones del Cierre de Jornada:
              </label>
              <textarea
                [(ngModel)]="closureNotes"
                rows="2"
                placeholder="Turno sin novedades, se realizó compra menor de insumos con soporte..."
                class="w-full rounded-xl border border-outline-variant bg-surface-container-low p-2.5 text-xs focus:border-primary-container outline-none resize-none"
              ></textarea>
            </div>

          </div>

          <!-- Right Column: Conciliación de Efectivo Físico & Arqueo Ciego (7 cols) -->
          <div class="lg:col-span-7 p-6 rounded-2xl bg-white border-2 border-primary-container/30 shadow-md space-y-5 flex flex-col justify-between">
            <div class="space-y-4">
              
              <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl bg-secondary-container/40 text-on-secondary-container flex items-center justify-center">
                    <span class="material-symbols-outlined text-xl">calculate</span>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-primary">Conciliación de Efectivo Físico</h3>
                    <p class="text-xs text-outline">Arqueo matemático del cajón vs. Dinero físico contado</p>
                  </div>
                </div>

                <span class="px-2.5 py-1 rounded-full text-xs font-bold"
                      [ngClass]="{
                        'bg-emerald-100 text-emerald-800 border border-emerald-300': difference() === 0,
                        'bg-rose-100 text-rose-800 border border-rose-300': difference() < 0,
                        'bg-blue-100 text-blue-800 border border-blue-300': difference() > 0
                      }">
                  {{ difference() === 0 ? 'Cuadre Exacto' : (difference() < 0 ? 'Faltante en Caja' : 'Sobrante en Caja') }}
                </span>
              </div>

              <!-- Mathematical Breakdown -->
              <div class="space-y-2 bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 text-xs">
                <div class="flex justify-between text-on-surface">
                  <span class="flex items-center gap-1.5 text-outline">
                    <span class="material-symbols-outlined text-sm">lock_open</span>
                    Base inicial de caja:
                  </span>
                  <span class="font-bold">{{ reg.opening_amount | currencyCop }}</span>
                </div>

                <div class="flex justify-between text-emerald-800">
                  <span class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">add_circle</span>
                    + Recaudos en efectivo:
                  </span>
                  <span class="font-bold">+{{ cashSalesTotal() | currencyCop }}</span>
                </div>

                <div class="flex justify-between text-rose-700">
                  <span class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">remove_circle</span>
                    - Egresos y retiros autorizados:
                  </span>
                  <span class="font-bold">-{{ cashExpensesTotal() | currencyCop }}</span>
                </div>

                <div class="pt-2 border-t border-outline-variant/40 flex justify-between items-center text-sm font-bold text-primary">
                  <span>= Efectivo Esperado en Cajón:</span>
                  <span class="text-base text-primary">{{ expectedCash() | currencyCop: true }}</span>
                </div>
              </div>

              <!-- Arqueo Ciego / Dinero Físico Contado -->
              <div class="space-y-2">
                <label class="block text-xs font-bold text-on-surface uppercase tracking-wider">
                  Dinero Físico Contado en Cajón:
                </label>
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold text-lg">$</span>
                  <input
                    type="number"
                    [(ngModel)]="countedCash"
                    placeholder="0"
                    class="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-primary-container bg-surface-container-lowest text-xl font-extrabold text-primary outline-none focus:ring-2 focus:ring-secondary-container"
                  />
                </div>
                <div class="flex justify-end gap-2 pt-1 text-xs">
                  <button
                    type="button"
                    (click)="countedCash = expectedCash()"
                    class="text-primary font-bold hover:underline"
                  >
                    Usar Cuadre Exacto
                  </button>
                </div>
              </div>

              <!-- Live Difference Box -->
              <div class="p-4 rounded-xl border-2 text-center"
                   [ngClass]="{
                     'bg-emerald-50 border-emerald-300 text-emerald-950': difference() === 0,
                     'bg-rose-50 border-rose-300 text-rose-950': difference() < 0,
                     'bg-blue-50 border-blue-300 text-blue-950': difference() > 0
                   }">
                <span class="text-[10px] font-bold uppercase tracking-wider">Diferencia de Arqueo</span>
                <div class="text-2xl font-extrabold mt-0.5">
                  {{ difference() | currencyCop: true }}
                </div>
                <p class="text-[11px] mt-0.5">
                  {{ difference() === 0 ? 'Todos los registros coinciden con el dinero físico.' : (difference() < 0 ? 'Existe un faltante respecto a lo registrado.' : 'Existe un sobrante no registrado.') }}
                </p>
              </div>

            </div>

            <!-- Big Final Action: Cerrar Caja y Finalizar Jornada -->
            <div class="pt-4 border-t border-outline-variant/30 space-y-2">
              <button
                type="button"
                (click)="openCloseConfirmModal.set(true)"
                class="w-full py-4 bg-primary-container hover:bg-primary text-white font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <span class="material-symbols-outlined text-lg">lock</span>
                <span>CERRAR CAJA Y FINALIZAR JORNADA</span>
              </button>
              <p class="text-[11px] text-center text-outline">
                Al confirmar se guardará el arqueo y se cerrará la caja de la jornada.
              </p>
            </div>

          </div>

        </div>

      }

      <!-- Modal Apertura de Caja -->
      @if (openRegisterModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-outline-variant/40 space-y-4">
            <h3 class="text-base font-bold text-primary">Apertura de Caja del Día</h3>
            <p class="text-xs text-on-surface-variant">
              Ingresa el saldo base en efectivo con el que se inicia el cajón para vueltos:
            </p>

            <div>
              <label class="block text-xs font-bold text-on-surface mb-1">Monto Base Inicial (COP):</label>
              <input
                type="number"
                [(ngModel)]="openingAmountInput"
                class="w-full p-2.5 rounded-xl border border-outline-variant text-base font-bold text-primary outline-none focus:border-primary-container"
              />
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="openRegisterModal.set(false)"
                class="px-4 py-2 rounded-xl border border-outline-variant text-xs font-bold text-outline hover:bg-surface-container"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmOpenRegister()"
                class="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary text-white text-xs font-bold shadow-xs"
              >
                Abrir Caja
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal Egreso Menor -->
      @if (openExpenseModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-outline-variant/40 space-y-4">
            <h3 class="text-base font-bold text-rose-800">Registrar Salida / Egreso Menor</h3>
            <p class="text-xs text-on-surface-variant">
              Registra retiros de efectivo con soporte (ej. compra de hielo de emergencia, insumos):
            </p>

            <div class="space-y-3">
              <div>
                <label class="block text-xs font-bold text-on-surface mb-1">Monto del Gasto (COP):</label>
                <input
                  type="number"
                  [(ngModel)]="expenseAmountInput"
                  placeholder="Ej. 40000"
                  class="w-full p-2.5 rounded-xl border border-outline-variant text-base font-bold text-rose-700 outline-none focus:border-rose-600"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-on-surface mb-1">Concepto / Motivo:</label>
                <input
                  type="text"
                  [(ngModel)]="expenseDescriptionInput"
                  placeholder="Ej. Compra hielo de emergencia para barra"
                  class="w-full p-2.5 rounded-xl border border-outline-variant text-xs outline-none focus:border-rose-600"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="openExpenseModal.set(false)"
                class="px-4 py-2 rounded-xl border border-outline-variant text-xs font-bold text-outline hover:bg-surface-container"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmExpense()"
                class="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs"
              >
                Guardar Egreso
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal Confirmación de Cierre de Jornada -->
      @if (openCloseConfirmModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-outline-variant/40 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
                <span class="material-symbols-outlined text-xl">lock</span>
              </div>
              <div>
                <h3 class="text-base font-bold text-primary">¿Confirmar Cierre de Jornada?</h3>
                <p class="text-xs text-outline">Esta acción congelará el balance contable del día</p>
              </div>
            </div>

            <div class="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/30 text-xs space-y-1.5">
              <div class="flex justify-between">
                <span>Efectivo Contado:</span>
                <span class="font-bold">{{ countedCash | currencyCop }}</span>
              </div>
              <div class="flex justify-between">
                <span>Efectivo Esperado:</span>
                <span class="font-bold">{{ expectedCash() | currencyCop }}</span>
              </div>
              <div class="flex justify-between font-bold pt-1 border-t border-outline-variant/30"
                   [ngClass]="difference() === 0 ? 'text-emerald-700' : 'text-rose-700'">
                <span>Diferencia:</span>
                <span>{{ difference() | currencyCop }}</span>
              </div>
            </div>

            @if (orderService.pendingPaymentOrders().length > 0) {
              <div class="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
                <span class="material-symbols-outlined text-base mt-0.5">warning</span>
                <span>Hay {{ orderService.pendingPaymentOrders().length }} pedidos aún sin cobrar. ¿Deseas cerrar de todas formas?</span>
              </div>
            }

            <p class="text-xs text-on-surface-variant leading-relaxed">
              Consecuencias del cierre:
              <br/>• Se guardará el total contado y la diferencia frente al saldo esperado.
              <br/>• Se generará el reporte Z y balance de la fecha.
            </p>

            <div class="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                (click)="openCloseConfirmModal.set(false)"
                class="px-4 py-2 rounded-xl border border-outline-variant text-xs font-bold text-outline hover:bg-surface-container"
              >
                CANCELAR
              </button>
              <button
                type="button"
                (click)="executeCloseDay()"
                class="px-5 py-2 rounded-xl bg-primary-container hover:bg-primary text-white text-xs font-bold shadow-md"
              >
                SÍ, FINALIZAR JORNADA
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
})
export class AdminCashComponent implements OnInit {
  readonly cashService = inject(CashService);
  readonly orderService = inject(OrderService);
  private readonly reportService = inject(ReportService);
  private readonly toast = inject(ToastService);

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

  countedCash = 150000;
  closureNotes = '';

  // Modals state
  readonly openRegisterModal = signal(false);
  openingAmountInput = 150000;

  readonly openExpenseModal = signal(false);
  expenseAmountInput = 40000;
  expenseDescriptionInput = '';

  readonly openCloseConfirmModal = signal(false);
  readonly reportError = signal('');

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.cashService.loadCurrentRegister(),
      this.orderService.loadPendingPaymentOrders(),
      this.loadReportData(),
    ]);

    // Inicializar countedCash con expected al cargar
    setTimeout(() => {
      this.countedCash = this.expectedCash();
    }, 500);
  }

  async loadReportData(): Promise<void> {
    this.reportError.set('');
    try {
      const data = await this.reportService.getReportData();
      this.summary.set(data);
    } catch (error) {
      console.error('Error cargando ventas para caja:', error);
      this.reportError.set(error instanceof Error ? error.message : 'Error al consultar Supabase.');
    }
  }

  readonly cashSalesTotal = computed(() => {
    const cashMethod = this.summary().paymentMethods.find((m) => m.method === 'cash');
    return cashMethod ? cashMethod.total : 0;
  });

  readonly digitalSales = computed(() => {
    return this.summary().paymentMethods
      .filter((m) => m.method !== 'cash')
      .reduce((sum, m) => sum + m.total, 0);
  });

  readonly cashExpensesTotal = computed(() => {
    return this.cashService.movements()
      .filter((m) => m.type === 'expense')
      .reduce((sum, m) => sum + m.amount, 0);
  });

  readonly expectedCash = computed(() => {
    const base = this.cashService.currentRegister()?.opening_amount || 0;
    return base + this.cashSalesTotal() - this.cashExpensesTotal();
  });

  readonly difference = computed(() => {
    return this.countedCash - this.expectedCash();
  });

  async confirmOpenRegister(): Promise<void> {
    const success = await this.cashService.openRegister(this.openingAmountInput);
    if (success) {
      this.openRegisterModal.set(false);
      this.countedCash = this.openingAmountInput;
      await this.loadReportData();
    }
  }

  async confirmExpense(): Promise<void> {
    if (!this.expenseDescriptionInput.trim()) {
      this.toast.warning('Ingresa el motivo del egreso.');
      return;
    }
    const success = await this.cashService.registerMovement(
      'expense',
      this.expenseAmountInput,
      this.expenseDescriptionInput.trim()
    );
    if (success) {
      this.openExpenseModal.set(false);
      this.expenseDescriptionInput = '';
      this.countedCash = this.expectedCash();
    }
  }

  async executeCloseDay(): Promise<void> {
    const reg = this.cashService.currentRegister();
    if (!reg) return;

    const res = await this.cashService.closeRegister(reg.id, this.countedCash, this.closureNotes);
    this.openCloseConfirmModal.set(false);
    if (res.success) {
      this.closureNotes = '';
      await this.loadReportData();
    }
  }
}
