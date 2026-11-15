import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseClientService } from '../../core/services/supabase-client.service';

interface BusinessListItem {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  is_active: boolean;
}

@Component({
  selector: 'app-platform-businesses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="min-h-screen bg-surface-container-low p-4 sm:p-8">
      <div class="mx-auto max-w-5xl space-y-6">
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-primary">Administración global</p>
            <h1 class="mt-1 text-2xl font-extrabold text-on-surface">Negocios de la plataforma</h1>
            <p class="mt-1 text-sm text-on-surface-variant">
              Registra un comercio y asigna su administrador inicial.
            </p>
          </div>
          <button type="button" (click)="signOut()" class="rounded-xl border border-outline-variant bg-white px-4 py-2 text-xs font-bold text-primary">
            Cerrar sesión
          </button>
        </header>

        @if (error()) {
          <div role="alert" class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {{ error() }}
          </div>
        }

        <form (ngSubmit)="createBusiness()" class="grid gap-4 rounded-2xl border border-outline-variant/40 bg-white p-5 shadow-xs sm:grid-cols-2">
          <label class="text-xs font-bold text-on-surface">
            Nombre del negocio
            <input [(ngModel)]="name" name="name" required minlength="2" maxlength="100" placeholder="Café Central"
              class="mt-1 w-full rounded-lg border border-outline-variant p-2.5 text-sm font-normal outline-none focus:border-primary" />
          </label>
          <label class="text-xs font-bold text-on-surface">
            Tipo de comercio
            <input [(ngModel)]="businessType" name="businessType" required minlength="2" maxlength="60" placeholder="Cafetería"
              class="mt-1 w-full rounded-lg border border-outline-variant p-2.5 text-sm font-normal outline-none focus:border-primary" />
          </label>
          <label class="text-xs font-bold text-on-surface">
            Enlace / identificador
            <div class="mt-1 flex items-center rounded-lg border border-outline-variant px-2.5 focus-within:border-primary">
              <span class="text-xs text-outline">/</span>
              <input [(ngModel)]="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="80"
                placeholder="cafe-central" (ngModelChange)="normalizeSlug()"
                class="w-full border-0 p-2 text-sm font-normal outline-none focus:ring-0" />
            </div>
          </label>
          <label class="text-xs font-bold text-on-surface">
            Correo del primer administrador
            <input [(ngModel)]="ownerEmail" name="ownerEmail" required type="email" placeholder="admin@negocio.com"
              class="mt-1 w-full rounded-lg border border-outline-variant p-2.5 text-sm font-normal outline-none focus:border-primary" />
          </label>
          <p class="text-xs leading-relaxed text-on-surface-variant sm:col-span-2">
            El correo debe existir y estar confirmado en Supabase Authentication. El administrador solo tendrá acceso a este negocio.
          </p>
          <div class="sm:col-span-2">
            <button type="submit" [disabled]="saving()"
              class="rounded-xl bg-primary-container px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary disabled:opacity-50">
              {{ saving() ? 'Creando negocio...' : 'Crear negocio y asignar administrador' }}
            </button>
          </div>
        </form>

        @if (createdBusinessSlug()) {
          <div role="status" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p>
              Negocio creado. URL de acceso:
              <a [href]="businessUrl(createdBusinessSlug())" class="font-bold underline">
                {{ businessUrl(createdBusinessSlug()) }}
              </a>
            </p>
            <button type="button" (click)="copyAccessUrl(createdBusinessSlug())"
              class="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold">
              {{ copiedBusinessSlug() === createdBusinessSlug() ? 'Copiada' : 'Copiar URL' }}
            </button>
          </div>
        }

        <section class="overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-xs">
          <div class="border-b border-outline-variant/30 px-5 py-4">
            <h2 class="text-sm font-bold text-on-surface">Negocios registrados</h2>
          </div>
          @if (loading()) {
            <p class="p-6 text-sm text-outline">Cargando...</p>
          } @else if (businesses().length === 0) {
            <p class="p-6 text-sm text-outline">No hay negocios registrados.</p>
          } @else {
            <div class="divide-y divide-outline-variant/20">
              @for (business of businesses(); track business.id) {
                <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div class="min-w-0 flex-1">
                    @if (editingBusinessId() === business.id) {
                      <div class="grid gap-2 sm:grid-cols-3">
                        <input [(ngModel)]="editName" [name]="'edit-name-' + business.id" required minlength="2" maxlength="100" aria-label="Nombre del negocio"
                          class="rounded-lg border border-outline-variant p-2 text-sm" />
                        <input [(ngModel)]="editBusinessType" [name]="'edit-type-' + business.id" required minlength="2" maxlength="60" aria-label="Tipo de comercio"
                          class="rounded-lg border border-outline-variant p-2 text-sm" />
                        <input [(ngModel)]="editSlug" [name]="'edit-slug-' + business.id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="80" aria-label="Identificador URL"
                          (ngModelChange)="normalizeEditSlug()" class="rounded-lg border border-outline-variant p-2 text-sm" />
                      </div>
                    } @else {
                      <p class="text-sm font-bold text-on-surface">{{ business.name }}</p>
                      <p class="mt-0.5 text-xs text-on-surface-variant">
                        {{ business.business_type }} · /{{ business.slug }}
                      </p>
                      <p class="mt-1 break-all text-xs text-on-surface-variant">{{ businessUrl(business.slug) }}</p>
                      <span class="mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold"
                        [ngClass]="business.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-container text-on-surface-variant'">
                        {{ business.is_active ? 'Activo' : 'Inactivo' }}
                      </span>
                    }
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    @if (editingBusinessId() === business.id) {
                      <button type="button" (click)="saveBusiness(business)" [disabled]="savingBusinessId() === business.id"
                        class="rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                        {{ savingBusinessId() === business.id ? 'Guardando...' : 'Guardar' }}
                      </button>
                      <button type="button" (click)="cancelEditing()" [disabled]="savingBusinessId() === business.id"
                        class="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold">
                        Cancelar
                      </button>
                    } @else {
                      @if (business.is_active) {
                        <a [href]="businessUrl(business.slug)" class="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-primary">
                          Abrir acceso
                        </a>
                      }
                      <button type="button" (click)="copyAccessUrl(business.slug)"
                        class="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-primary">
                        {{ copiedBusinessSlug() === business.slug ? 'Copiada' : 'Copiar URL' }}
                      </button>
                      <button type="button" (click)="startEditing(business)"
                        class="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface">
                        Modificar
                      </button>
                      <button type="button" (click)="toggleBusinessStatus(business)"
                        [disabled]="togglingBusinessId() === business.id"
                        class="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface disabled:opacity-50">
                        {{ togglingBusinessId() === business.id ? 'Guardando...' : business.is_active ? 'Desactivar' : 'Activar' }}
                      </button>
                      <button type="button" (click)="beginDelete(business)" [disabled]="deletingBusinessId() === business.id"
                        class="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">
                        Eliminar
                      </button>
                    }
                  </div>
                  @if (deleteConfirmationBusinessId() === business.id) {
                    <div role="alertdialog" aria-label="Confirmar eliminación permanente"
                      class="basis-full rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                      <p class="font-bold">¿Estás seguro? Se eliminarán permanentemente el comercio y sus datos operativos.</p>
                      <p class="mt-1">No se eliminará la cuenta de Supabase Auth del administrador. Escribe <strong>{{ business.slug }}</strong> para confirmar.</p>
                      <div class="mt-3 flex flex-wrap items-center gap-2">
                        <input [(ngModel)]="deleteSlugConfirmation" [name]="'confirm-delete-' + business.id"
                          [attr.aria-label]="'Escribe ' + business.slug + ' para confirmar'" autocomplete="off"
                          class="min-w-48 rounded-lg border border-rose-300 bg-white p-2 text-sm" />
                        <button type="button" (click)="deleteBusiness(business)"
                          [disabled]="deleteSlugConfirmation !== business.slug || deletingBusinessId() === business.id"
                          class="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                          {{ deletingBusinessId() === business.id ? 'Eliminando...' : 'Confirmar eliminación' }}
                        </button>
                        <button type="button" (click)="cancelDelete()" [disabled]="deletingBusinessId() === business.id"
                          class="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </section>
      </div>
    </main>
  `,
})
export class PlatformBusinessesComponent implements OnInit {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly router = inject(Router);

  readonly businesses = signal<BusinessListItem[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly createdBusinessSlug = signal('');
  readonly copiedBusinessSlug = signal('');
  readonly togglingBusinessId = signal('');
  readonly editingBusinessId = signal('');
  readonly savingBusinessId = signal('');
  readonly deleteConfirmationBusinessId = signal('');
  readonly deletingBusinessId = signal('');

  name = '';
  businessType = '';
  slug = '';
  ownerEmail = '';
  editName = '';
  editBusinessType = '';
  editSlug = '';
  deleteSlugConfirmation = '';

  async ngOnInit(): Promise<void> {
    await this.loadBusinesses();
  }

  normalizeSlug(): void {
    this.slug = this.slug
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  normalizeEditSlug(): void {
    this.editSlug = this.editSlug
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  businessUrl(slug: string): string {
    return `${window.location.origin}/${slug}/login`;
  }

  async copyAccessUrl(slug: string): Promise<void> {
    this.error.set('');
    try {
      await navigator.clipboard.writeText(this.businessUrl(slug));
      this.copiedBusinessSlug.set(slug);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'El navegador no permitió copiar la URL.';
      console.error('No se pudo copiar la URL del negocio:', error);
      this.error.set(`No se pudo copiar la URL. ${message}`);
    }
  }

  async createBusiness(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    this.createdBusinessSlug.set('');
    try {
      const { data, error } = await this.supabase.rpc('create_business', {
        p_name: this.name.trim(),
        p_slug: this.slug,
        p_business_type: this.businessType.trim(),
        p_owner_email: this.ownerEmail.trim(),
      });
      if (error) throw error;
      if (!data) throw new Error('Supabase no devolvió el negocio creado.');

      const createdSlug = typeof data.slug === 'string' ? data.slug : this.slug;
      this.createdBusinessSlug.set(createdSlug);
      this.name = '';
      this.businessType = '';
      this.slug = '';
      this.ownerEmail = '';
      await this.loadBusinesses();
    } catch (error: unknown) {
      const message = this.isUniqueViolation(error)
        ? 'Ese identificador URL ya está en uso. Elige otro.'
        : this.errorMessage(error, 'No se pudo crear el negocio. Revisa los datos e inténtalo de nuevo.');
      console.error('No se pudo crear el negocio:', error);
      this.error.set(message);
    } finally {
      this.saving.set(false);
    }
  }

  async toggleBusinessStatus(business: BusinessListItem): Promise<void> {
    this.togglingBusinessId.set(business.id);
    this.error.set('');
    try {
      const nextStatus = !business.is_active;
      const { data, error } = await this.supabase.rpc('set_business_active', {
        p_business_id: business.id,
        p_is_active: nextStatus,
      });
      if (error) throw error;
      if (data?.is_active !== nextStatus) {
        throw new Error('Supabase no confirmó el nuevo estado del negocio.');
      }
      await this.loadBusinesses();
    } catch (error: unknown) {
      const message = this.errorMessage(error, 'No se pudo cambiar el estado del negocio.');
      console.error('No se pudo cambiar el estado del negocio:', error);
      this.error.set(message);
    } finally {
      this.togglingBusinessId.set('');
    }
  }

  startEditing(business: BusinessListItem): void {
    this.error.set('');
    this.deleteConfirmationBusinessId.set('');
    this.editingBusinessId.set(business.id);
    this.editName = business.name;
    this.editBusinessType = business.business_type;
    this.editSlug = business.slug;
  }

  cancelEditing(): void {
    this.editingBusinessId.set('');
    this.editName = '';
    this.editBusinessType = '';
    this.editSlug = '';
  }

  async saveBusiness(business: BusinessListItem): Promise<void> {
    const name = this.editName.trim();
    const businessType = this.editBusinessType.trim();
    const slug = this.editSlug.trim();
    if (name.length < 2 || name.length > 100 || businessType.length < 2 || businessType.length > 60) {
      this.error.set('El nombre debe tener entre 2 y 100 caracteres y el tipo entre 2 y 60.');
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      this.error.set('El identificador debe usar minúsculas, números y guiones.');
      return;
    }

    this.savingBusinessId.set(business.id);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('update_platform_business', {
        p_business_id: business.id,
        p_name: name,
        p_slug: slug,
        p_business_type: businessType,
      });
      if (error) throw error;
      if (data?.slug !== slug) {
        throw new Error('Supabase no confirmó los cambios del negocio.');
      }

      this.cancelEditing();
      await this.loadBusinesses();
    } catch (error: unknown) {
      const message = this.isUniqueViolation(error)
        ? 'Ese identificador URL ya está en uso. Elige otro.'
        : this.errorMessage(error, 'No se pudieron guardar los cambios del negocio.');
      console.error('No se pudieron guardar los cambios del negocio:', error);
      this.error.set(message);
    } finally {
      this.savingBusinessId.set('');
    }
  }

  beginDelete(business: BusinessListItem): void {
    this.error.set('');
    this.cancelEditing();
    this.deleteConfirmationBusinessId.set(business.id);
    this.deleteSlugConfirmation = '';
  }

  cancelDelete(): void {
    this.deleteConfirmationBusinessId.set('');
    this.deleteSlugConfirmation = '';
  }

  async deleteBusiness(business: BusinessListItem): Promise<void> {
    if (this.deleteSlugConfirmation !== business.slug) return;

    this.deletingBusinessId.set(business.id);
    this.error.set('');
    let businessDeleted = false;
    try {
      const { error } = await this.supabase.rpc('delete_platform_business', {
        p_business_id: business.id,
        p_confirmation_slug: this.deleteSlugConfirmation,
      });
      if (error) throw error;
      businessDeleted = true;
      this.cancelDelete();
      await this.loadBusinesses();
      await this.removeBusinessStorageFiles(business.id);
    } catch (error: unknown) {
      const message = this.errorMessage(
        error,
        businessDeleted
          ? 'El comercio fue eliminado, pero no se pudieron eliminar todos sus archivos.'
          : 'No se pudo eliminar el comercio.',
      );
      console.error('No se pudo completar la eliminación del negocio:', error);
      this.error.set(businessDeleted
        ? `El comercio y sus datos fueron eliminados, pero algunos archivos podrían seguir almacenados. ${message}`
        : message);
    } finally {
      this.deletingBusinessId.set('');
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      this.error.set(error.message);
      return;
    }
    await this.router.navigate(['/platform/login']);
  }

  private async loadBusinesses(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase
        .from('businesses')
        .select('id, name, slug, business_type, is_active')
        .order('created_at', { ascending: true });
      if (error) throw error;
      this.businesses.set((data ?? []) as BusinessListItem[]);
    } catch (error: unknown) {
      const message = this.errorMessage(error, 'No se pudieron cargar los negocios.');
      console.error('No se pudieron cargar los negocios:', error);
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  }

  private async removeBusinessStorageFiles(businessId: string): Promise<void> {
    await this.removeStorageFolder('product-images', `${businessId}/products`);
    await this.removeStorageFolder('business-branding', businessId);
  }

  private async removeStorageFolder(bucket: string, folder: string): Promise<void> {
    const storage = this.supabase.storage.from(bucket);
    let offset = 0;
    const pageSize = 100;
    const paths: string[] = [];
    while (true) {
      const { data, error } = await storage.list(folder, {
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw error;

      paths.push(...(data ?? [])
        .filter((file) => file.id !== null)
        .map((file) => `${folder}/${file.name}`));
      if ((data ?? []).length < pageSize) break;
      offset += pageSize;
    }

    for (let index = 0; index < paths.length; index += pageSize) {
      const { error } = await storage.remove(paths.slice(index, index + pageSize));
      if (error) throw error;
    }
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
    return fallback;
  }
}
