import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-background flex flex-col justify-center items-center p-4 selection:bg-secondary-container selection:text-on-secondary-container">
      <!-- Background subtle decorative circle -->
      <div class="fixed -top-32 -right-32 w-96 h-96 bg-secondary-container/30 rounded-full blur-3xl pointer-events-none"></div>
      <div class="fixed -bottom-32 -left-32 w-96 h-96 bg-primary-container/20 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Main Login Container -->
      <div class="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 overflow-hidden relative z-10">
        <!-- Brand Header -->
        <div class="bg-primary-container p-6 text-center text-surface-container-lowest relative">
          <div class="w-20 h-20 mx-auto mb-3 rounded-full bg-surface-container-lowest p-1 shadow-md border-2 border-secondary-fixed flex items-center justify-center overflow-hidden">
            <img src="logo.png" alt="Candy El Progreso" class="w-full h-full object-cover rounded-full" />
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-white">Candy El Progreso</h1>
          <p class="text-xs text-secondary-fixed font-medium tracking-wider uppercase mt-1">
            Sistema POS &amp; Heladería Artesanal
          </p>
        </div>

        <!-- Mode Switcher Tabs -->
        <div class="flex border-b border-surface-container-high bg-surface-container-low">
          <button
            type="button"
            (click)="activeTab.set('employee')"
            class="flex-1 py-3.5 text-center font-bold text-sm transition-all border-b-2 flex items-center justify-center gap-2"
            [ngClass]="activeTab() === 'employee'
              ? 'border-primary-container text-primary-container bg-surface-container-lowest'
              : 'border-transparent text-on-surface-variant hover:text-primary'"
          >
            <span class="material-symbols-outlined text-lg">badge</span>
            <span>Empleado</span>
          </button>
          <button
            type="button"
            (click)="activeTab.set('admin')"
            class="flex-1 py-3.5 text-center font-bold text-sm transition-all border-b-2 flex items-center justify-center gap-2"
            [ngClass]="activeTab() === 'admin'
              ? 'border-primary-container text-primary-container bg-surface-container-lowest'
              : 'border-transparent text-on-surface-variant hover:text-primary'"
          >
            <span class="material-symbols-outlined text-lg">admin_panel_settings</span>
            <span>Administrador</span>
          </button>
        </div>

        <!-- Content Body -->
        <div class="p-6">
          <!-- 1. TAB EMPLEADO (Acceso autorizado por administrador) -->
          @if (activeTab() === 'employee') {
            <div class="space-y-4">
              <div class="bg-secondary-container/20 p-3 rounded-xl border border-secondary-container/40 flex items-start gap-2.5">
                <span class="material-symbols-outlined text-secondary text-xl shrink-0 mt-0.5">storefront</span>
                <p class="text-xs text-on-surface-variant leading-relaxed">
                  El acceso no requiere cédula ni PIN. El administrador debe habilitar el salón para la jornada.
                </p>
              </div>

              <button
                type="button"
                (click)="handleEmployeeAccess()"
                [disabled]="isSubmitting()"
                class="w-full py-3 px-4 bg-primary-container hover:bg-primary text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span class="material-symbols-outlined text-lg">login</span>
                <span>{{ isSubmitting() ? 'Verificando acceso...' : 'ENTRAR AL SALÓN' }}</span>
              </button>
            </div>
          }

          <!-- 2. TAB ADMINISTRADOR (Email + Contraseña) -->
          @if (activeTab() === 'admin') {
            <form (ngSubmit)="handleAdminLogin()" class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
                  Correo Electrónico:
                </label>
                <div class="relative">
                  <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                    mail
                  </span>
                  <input
                    type="email"
                    [(ngModel)]="adminEmail"
                    name="adminEmail"
                    required
                    placeholder="admin@candyelprogreso.com"
                    class="w-full pl-10 pr-3 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant text-sm focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
                  Contraseña:
                </label>
                <div class="relative">
                  <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                    lock
                  </span>
                  <input
                    type="password"
                    [(ngModel)]="adminPassword"
                    name="adminPassword"
                    required
                    placeholder="••••••••"
                    class="w-full pl-10 pr-3 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant text-sm focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                [disabled]="isSubmitting()"
                class="w-full py-3 px-4 bg-primary-container hover:bg-primary text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span class="material-symbols-outlined text-lg">lock_open</span>
                <span>{{ isSubmitting() ? 'Iniciando sesión...' : 'INGRESAR AL PANEL ADMIN' }}</span>
              </button>

            </form>
          }
        </div>
      </div>

      <!-- App version & footer -->
      <footer class="mt-6 text-center text-xs text-on-surface-variant font-medium">
        Candy El Progreso • POS Versión 2.0 • Conectado a Supabase
      </footer>
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly activeTab = signal<'employee' | 'admin'>('employee');
  readonly isSubmitting = signal(false);

  adminEmail = '';
  adminPassword = '';

  async handleEmployeeAccess(): Promise<void> {
    this.isSubmitting.set(true);
    try {
      await this.auth.enterSalonMode();
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async handleAdminLogin(): Promise<void> {
    if (!this.adminEmail.trim() || !this.adminPassword) {
      this.toast.warning('Ingresa correo y contraseña.');
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.auth.signInAdmin(this.adminEmail, this.adminPassword);
    } finally {
      this.isSubmitting.set(false);
    }
  }

}
