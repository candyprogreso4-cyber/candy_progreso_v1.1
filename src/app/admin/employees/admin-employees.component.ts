import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeAccessService } from '../../core/services/employee-access.service';
import { ToastService } from '../../core/services/toast.service';
import { Employee } from '../../core/models/pos.types';

@Component({
  selector: 'app-admin-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-primary">Personal y acceso</h1>
          <p class="text-xs text-on-surface-variant mt-0.5">
            El acceso al salón se habilita globalmente para toda la jornada desde el botón del panel.
          </p>
        </div>
        <button
          type="button"
          (click)="openCreateModal()"
          class="px-4 py-2 bg-primary-container hover:bg-primary text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
        >
          <span class="material-symbols-outlined text-sm">person_add</span>
          <span>REGISTRAR EMPLEADO</span>
        </button>
      </div>

      <div class="bg-white rounded-2xl p-6 border border-outline-variant/30 shadow-xs space-y-4">
        <div class="border-b border-outline-variant/20 pb-3">
          <h2 class="text-base font-bold text-primary">Empleados registrados</h2>
          <p class="text-xs text-outline">
            El equipo comparte el usuario «Salón» al crear pedidos. Esta lista es solo de referencia.
          </p>
        </div>

        <div class="divide-y divide-outline-variant/20">
          @for (emp of accessService.employees(); track emp.id) {
            <div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-surface-container text-primary font-bold text-xs flex items-center justify-center border border-outline-variant">
                  {{ emp.full_name.substring(0, 2).toUpperCase() }}
                </div>
                <div>
                  <h3 class="text-sm font-bold text-on-surface">{{ emp.full_name }}</h3>
                  <p class="text-xs text-outline font-mono">C.C. {{ emp.identification }}</p>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <span
                  class="px-2.5 py-1 rounded-full text-[10px] font-bold"
                  [ngClass]="emp.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'"
                >
                  {{ emp.is_active ? 'Activo' : 'Inactivo' }}
                </span>
                <button
                  type="button"
                  (click)="toggleStatus(emp)"
                  class="p-2 rounded-lg hover:bg-surface-container text-outline hover:text-primary transition-colors"
                  [title]="emp.is_active ? 'Desactivar registro' : 'Activar registro'"
                >
                  <span class="material-symbols-outlined text-xl">
                    {{ emp.is_active ? 'toggle_on' : 'toggle_off' }}
                  </span>
                </button>
              </div>
            </div>
          }

          @if (accessService.employees().length === 0) {
            <div class="text-center py-10 text-xs text-outline">
              No hay empleados de referencia registrados. Puedes agregarlos con el botón superior.
            </div>
          }
        </div>
      </div>

      @if (showEmployeeModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            (ngSubmit)="submitEmployee()"
            class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-outline-variant/40 space-y-4"
          >
            <div>
              <h2 class="text-base font-bold text-primary">
                Registrar empleado
              </h2>
              <p class="text-xs text-outline mt-1">Registro informativo; no requiere credenciales.</p>
            </div>

            <div class="space-y-3">
              <label class="block text-xs font-bold text-on-surface">
                Nombre completo
                <input
                  type="text"
                  [(ngModel)]="newEmployeeName"
                  name="employeeName"
                  required
                  minlength="2"
                  autocomplete="name"
                  class="mt-1 w-full p-2.5 rounded-xl border border-outline-variant text-sm outline-none focus:border-primary-container"
                />
              </label>
              <label class="block text-xs font-bold text-on-surface">
                Cédula de referencia
                <input
                  type="text"
                  [(ngModel)]="newEmployeeIdentification"
                  name="employeeIdentification"
                  required
                  minlength="5"
                  inputmode="numeric"
                  autocomplete="off"
                  class="mt-1 w-full p-2.5 rounded-xl border border-outline-variant text-sm outline-none focus:border-primary-container"
                />
              </label>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="closeModal()"
                class="px-4 py-2 rounded-xl border border-outline-variant text-xs font-bold text-outline hover:bg-surface-container"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="accessService.isLoading()"
                class="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {{ accessService.isLoading() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      }
    </div>
  `,
})
export class AdminEmployeesComponent implements OnInit {
  readonly accessService = inject(EmployeeAccessService);
  private readonly toast = inject(ToastService);

  readonly showEmployeeModal = signal(false);
  newEmployeeName = '';
  newEmployeeIdentification = '';

  async ngOnInit(): Promise<void> {
    await this.accessService.loadEmployees();
  }

  openCreateModal(): void {
    this.showEmployeeModal.set(true);
  }

  closeModal(): void {
    this.showEmployeeModal.set(false);
    this.newEmployeeName = '';
    this.newEmployeeIdentification = '';
  }

  async submitEmployee(): Promise<void> {
    if (this.newEmployeeName.trim().length < 2 || this.newEmployeeIdentification.trim().length < 5) {
      this.toast.warning('Ingresa un nombre y una cédula de referencia válidos.');
      return;
    }

    const success = await this.accessService.createEmployee({
      full_name: this.newEmployeeName.trim(),
      identification: this.newEmployeeIdentification.trim(),
    });

    if (success) this.closeModal();
  }

  async toggleStatus(employee: Employee): Promise<void> {
    await this.accessService.toggleEmployeeStatus(employee.id, employee.is_active);
  }

}
