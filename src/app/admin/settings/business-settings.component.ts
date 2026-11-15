import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusinessBrandingUpdate } from '../../core/models/business.types';
import { BusinessService } from '../../core/services/business.service';

@Component({
  selector: 'app-business-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="mx-auto max-w-3xl space-y-5">
      <header>
        <p class="text-xs font-bold uppercase tracking-wider text-primary">Personalización</p>
        <h1 class="mt-1 text-2xl font-extrabold text-on-surface">Identidad del negocio</h1>
        <p class="mt-1 text-sm text-on-surface-variant">
          Configura la información y los colores que identifican tu comercio en el POS.
        </p>
      </header>

      <form (ngSubmit)="save()" class="space-y-5 rounded-2xl border border-outline-variant/40 bg-white p-5 shadow-xs">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="text-xs font-bold text-on-surface">
            Nombre del negocio
            <input
              type="text"
              name="businessName"
              [(ngModel)]="name"
              required
              minlength="2"
              maxlength="100"
              class="mt-1 w-full rounded-lg border border-outline-variant p-2.5 text-sm font-normal outline-none focus:border-primary"
            />
          </label>
          <label class="text-xs font-bold text-on-surface">
            Tipo de negocio
            <input
              type="text"
              name="businessType"
              [(ngModel)]="businessType"
              required
              minlength="2"
              maxlength="60"
              placeholder="Cafetería, tienda, restaurante..."
              class="mt-1 w-full rounded-lg border border-outline-variant p-2.5 text-sm font-normal outline-none focus:border-primary"
            />
          </label>
        </div>

        <label class="block text-xs font-bold text-on-surface">
          Logo del negocio
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            (change)="onLogoSelected($event)"
            class="mt-1 w-full rounded-lg border border-outline-variant p-2.5 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-surface-container file:px-3 file:py-1.5 file:text-xs file:font-bold"
          />
          <span class="mt-1 block font-normal text-on-surface-variant">
            JPG, PNG o WebP, hasta 3 MB.
          </span>
        </label>

        @if (logoPreview()) {
          <div class="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
            <img [src]="logoPreview()" [alt]="'Logo de ' + name" class="h-14 w-14 rounded-lg bg-white object-contain" />
            <span class="text-sm font-semibold text-on-surface">{{ name }}</span>
          </div>
        }

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/50 p-3 text-xs font-bold text-on-surface">
            Color principal
            <input
              type="color"
              name="primaryColor"
              [(ngModel)]="primaryColor"
              class="h-10 w-14 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </label>
          <label class="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/50 p-3 text-xs font-bold text-on-surface">
            Color secundario
            <input
              type="color"
              name="secondaryColor"
              [(ngModel)]="secondaryColor"
              class="h-10 w-14 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </label>
        </div>

        <div class="flex items-center justify-between gap-3 border-t border-outline-variant/30 pt-4">
          <p class="text-xs text-on-surface-variant">Identificador: <strong>{{ business.branding().slug }}</strong></p>
          <button
            type="submit"
            [disabled]="saving() || uploadingLogo() || !business.branding().id"
            class="rounded-xl bg-primary-container px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ uploadingLogo() ? 'Subiendo logo...' : saving() ? 'Guardando...' : 'Guardar identidad' }}
          </button>
        </div>
      </form>

      <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        Esta identidad solo se aplica al comercio seleccionado; cada comercio mantiene su propia configuración.
      </div>
    </section>
  `,
})
export class BusinessSettingsComponent implements OnInit, OnDestroy {
  readonly business = inject(BusinessService);
  readonly saving = signal(false);
  readonly uploadingLogo = signal(false);
  readonly logoPreview = signal('');

  name = '';
  businessType = '';
  logoUrl = '';
  private logoFile: File | null = null;
  private previewObjectUrl: string | null = null;
  primaryColor = '#5E2748';
  secondaryColor = '#F2B84B';

  async ngOnInit(): Promise<void> {
    const branding = this.business.branding();
    this.name = branding.name;
    this.businessType = branding.business_type;
    this.logoUrl = branding.logo_url ?? '';
    this.logoPreview.set(this.logoUrl);
    this.primaryColor = branding.primary_color;
    this.secondaryColor = branding.secondary_color;
  }

  ngOnDestroy(): void {
    this.clearLogoPreview();
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.clearLogoPreview();
    this.logoFile = file;
    this.logoUrl = '';

    if (file) {
      this.previewObjectUrl = URL.createObjectURL(file);
      this.logoPreview.set(this.previewObjectUrl);
    } else {
      this.logoPreview.set('');
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      if (this.logoFile) {
        this.uploadingLogo.set(true);
        const uploadedLogo = await this.business.uploadLogo(this.logoFile);
        this.uploadingLogo.set(false);
        if (!uploadedLogo) return;
        this.logoUrl = uploadedLogo;
      }

      const updates: BusinessBrandingUpdate = {
        name: this.name.trim(),
        business_type: this.businessType.trim(),
        logo_url: this.logoUrl.trim() || null,
        primary_color: this.primaryColor,
        secondary_color: this.secondaryColor,
      };
      if (await this.business.updateBranding(updates)) {
        this.logoFile = null;
        this.logoPreview.set(this.logoUrl);
        this.clearLogoPreview();
      }
    } finally {
      this.uploadingLogo.set(false);
      this.saving.set(false);
    }
  }

  private clearLogoPreview(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }
}
