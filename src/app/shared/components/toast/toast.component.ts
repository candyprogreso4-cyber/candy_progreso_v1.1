import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto rounded-xl p-3.5 shadow-lg border flex items-start gap-3 transition-all transform duration-200 animate-slide-in"
          [ngClass]="{
            'bg-white border-emerald-300 text-emerald-950 shadow-emerald-500/10': toast.type === 'success',
            'bg-white border-rose-300 text-rose-950 shadow-rose-500/10': toast.type === 'error',
            'bg-white border-amber-300 text-amber-950 shadow-amber-500/10': toast.type === 'warning',
            'bg-white border-purple-300 text-purple-950 shadow-purple-500/10': toast.type === 'info'
          }"
        >
          <div class="shrink-0 mt-0.5">
            @switch (toast.type) {
              @case ('success') {
                <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center material-symbols-outlined text-sm">
                  check_circle
                </span>
              }
              @case ('error') {
                <span class="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center material-symbols-outlined text-sm">
                  error
                </span>
              }
              @case ('warning') {
                <span class="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center material-symbols-outlined text-sm">
                  warning
                </span>
              }
              @default {
                <span class="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center material-symbols-outlined text-sm">
                  info
                </span>
              }
            }
          </div>

          <div class="flex-1 min-w-0">
            @if (toast.title) {
              <h4 class="text-xs font-bold uppercase tracking-wider mb-0.5"
                  [ngClass]="{
                    'text-emerald-800': toast.type === 'success',
                    'text-rose-800': toast.type === 'error',
                    'text-amber-800': toast.type === 'warning',
                    'text-purple-800': toast.type === 'info'
                  }">
                {{ toast.title }}
              </h4>
            }
            <p class="text-sm font-medium text-slate-700 leading-snug break-words">
              {{ toast.message }}
            </p>
          </div>

          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            class="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
          >
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
}
