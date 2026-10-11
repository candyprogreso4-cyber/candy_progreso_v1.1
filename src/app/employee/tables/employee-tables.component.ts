import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TableService } from '../../core/services/table.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/auth/auth.service';
import { DiningTable } from '../../core/models/pos.types';

@Component({
  selector: 'app-employee-tables',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4 pb-24">
      
      <!-- Sección 1: Turno de Empleado Info -->
      <section class="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-surface-container-high rounded-full pointer-events-none opacity-60"></div>
        <div class="flex items-start justify-between mb-3 relative z-10">
          <div>
            <span class="inline-block px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold uppercase tracking-wider mb-1">
              TURNO ACTIVO
            </span>
            <h2 class="text-lg font-bold text-primary-container leading-tight">
              Bienvenido a Candy El Progreso
            </h2>
            <p class="text-xs text-on-surface-variant mt-0.5">
              Selecciona una mesa para tomar el pedido de salón
            </p>
          </div>
        </div>

        <div class="pt-2.5 border-t border-surface-container-high flex items-center gap-2 text-on-surface-variant relative z-10">
          <span class="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
          <p class="text-xs text-on-surface">
            <span class="font-bold text-primary">Mozo en turno:</span>
            {{ auth.employee()?.full_name || auth.currentUserName() }}
            <span class="text-outline font-medium">(Jornada en curso)</span>
          </p>
        </div>
      </section>

      <!-- Sección 2: Selector de Mesas -->
      <section class="space-y-3">
        <div class="flex items-baseline justify-between px-1">
          <div>
            <span class="inline-block px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold uppercase mb-0.5">
              SALÓN
            </span>
            <h3 class="text-base font-bold text-primary-container">¿Para qué mesa es el pedido?</h3>
          </div>
          <span class="text-xs font-semibold text-outline">8 Mesas físicas</span>
        </div>

        <!-- Leyenda de Estados en vivo -->
        <div class="flex items-center gap-4 py-1.5 px-3 bg-surface-container-low rounded-xl text-xs">
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span class="text-[11px] font-medium text-on-surface-variant">Disponible</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span class="text-[11px] font-medium text-on-surface-variant">Pedido activo</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-primary-container"></span>
            <span class="text-[11px] font-medium text-on-surface-variant">Seleccionada</span>
          </div>
        </div>

        @if (tableService.isLoading()) {
          <div class="rounded-xl bg-white p-6 text-center text-sm text-on-surface-variant">
            Cargando mesas...
          </div>
        } @else if (tableService.loadError()) {
          <div class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p>{{ tableService.loadError() }}</p>
            <button type="button" (click)="loadTables()" class="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary border border-rose-200">
              Reintentar
            </button>
          </div>
        } @else if (tableService.tables().length === 0) {
          <div class="rounded-xl bg-white p-6 text-center text-sm text-on-surface-variant">
            No hay mesas registradas. Solicita al administrador que configure las mesas.
          </div>
        } @else {
        <!-- Mesas cargadas desde la base de datos -->
        <div class="grid grid-cols-2 gap-3">
          @for (table of tableService.tables(); track table.id) {
            <div
              (click)="selectTable(table)"
              class="rounded-xl p-3.5 shadow-xs transition-all cursor-pointer active:scale-[0.98] select-none"
              [ngClass]="{
                'bg-[#FFF0F5] border-2 border-primary-container ring-2 ring-secondary-container/40 shadow-sm': isTableSelected(table),
                'bg-surface-container-low border border-blue-200 opacity-90': table.status === 'occupied' && !isTableSelected(table),
                'bg-surface-container-lowest border border-outline-variant/40 hover:border-secondary-container hover:shadow-sm': table.status === 'available' && !isTableSelected(table)
              }"
            >
              <div class="flex items-center justify-between">
                <span class="font-bold text-sm text-primary-container">
                  Mesa {{ table.table_number }}
                </span>
                @if (isTableSelected(table)) {
                  <span class="material-symbols-outlined text-primary-container text-lg">radio_button_checked</span>
                } @else if (table.status === 'occupied') {
                  <span class="material-symbols-outlined text-blue-500 text-lg">receipt</span>
                } @else {
                  <span class="material-symbols-outlined text-outline-variant text-lg">restaurant</span>
                }
              </div>

              <div class="mt-2.5 flex items-center gap-1.5">
                @if (isTableSelected(table)) {
                  <span class="material-symbols-outlined text-primary-container text-xs">check</span>
                  <span class="text-[11px] font-bold text-primary-container">✓ Mesa Seleccionada</span>
                } @else if (table.status === 'occupied') {
                  <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span class="text-[11px] font-semibold text-blue-700">Pedido activo</span>
                } @else {
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span class="text-[11px] font-medium text-emerald-700">Disponible</span>
                }
              </div>
            </div>
          }
        </div>
        }
      </section>

      <!-- Action Button if Table Selected -->
      @if (cartService.selectedTable()) {
        <div class="sticky bottom-20 z-20 pt-2">
          <button
            type="button"
            (click)="goToMenu()"
            class="w-full py-3.5 bg-primary-container hover:bg-primary text-white font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all"
          >
            <span>CONTINUAR A LA CARTA (Mesa {{ cartService.selectedTable()?.table_number }})</span>
            <span class="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class EmployeeTablesComponent implements OnInit {
  readonly tableService = inject(TableService);
  readonly cartService = inject(CartService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.loadTables();
  }

  async loadTables(): Promise<void> {
    await this.tableService.loadTables();
  }

  isTableSelected(table: DiningTable): boolean {
    return this.cartService.selectedTable()?.id === table.id;
  }

  selectTable(table: DiningTable): void {
    this.cartService.setTable(table);
    // Transición directa al menú para agilidad del mozo
    this.goToMenu();
  }

  goToMenu(): void {
    this.router.navigate(['/employee/menu']);
  }
}
