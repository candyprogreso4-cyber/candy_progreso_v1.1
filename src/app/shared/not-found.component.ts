import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <section class="max-w-md rounded-2xl border border-outline-variant/40 bg-white p-8 shadow-sm">
        <span class="material-symbols-outlined text-5xl text-primary">storefront</span>
        <h1 class="mt-3 text-xl font-bold text-on-surface">No encontramos este comercio</h1>
        <p class="mt-2 text-sm text-on-surface-variant">
          Revisa el enlace o solicita al administrador la dirección correcta.
        </p>
        <a
          routerLink="/platform/login"
          class="mt-5 inline-flex rounded-xl bg-primary-container px-4 py-2.5 text-sm font-bold text-white"
        >Ir al acceso</a>
      </section>
    </main>
  `,
})
export class NotFoundComponent {}
