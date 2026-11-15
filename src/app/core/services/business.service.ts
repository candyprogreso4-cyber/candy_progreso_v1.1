import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { ToastService } from './toast.service';
import { BusinessBranding, BusinessBrandingUpdate } from '../models/business.types';

const PLATFORM_BRANDING: BusinessBranding = {
  id: '',
  name: 'Develoyer Sistem POS',
  slug: '',
  business_type: 'Plataforma SaaS',
  logo_url: null,
  primary_color: '#4F46E5',
  secondary_color: '#F59E0B',
};

const MIN_TEXT_CONTRAST = 4.5;
const SURFACE_COLOR = '#fff7fe';

@Injectable({
  providedIn: 'root',
})
export class BusinessService {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly toast = inject(ToastService);

  readonly branding = signal<BusinessBranding>(PLATFORM_BRANDING);
  readonly isLoading = signal(false);

  resetPlatformBranding(): void {
    this.branding.set(PLATFORM_BRANDING);
    this.applyTheme(PLATFORM_BRANDING);
  }

  adminPath(section = 'dashboard'): string {
    if (!this.branding().id) return '/platform/businesses';
    return `/${this.branding().slug}/admin/${section}`;
  }

  employeePath(section = 'tables'): string {
    if (!this.branding().id) return '/platform/login';
    return `/${this.branding().slug}/employee/${section}`;
  }

  loginPath(): string {
    if (!this.branding().id) return '/platform/login';
    return `/${this.branding().slug}/login`;
  }

  async loadBranding(slug: string): Promise<BusinessBranding | null> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase.rpc('get_business_branding', {
        p_slug: slug,
      });
      if (error) throw error;
      if (!data) throw new Error(`No se encontró el negocio "${slug}".`);

      const brand = data as BusinessBranding;
      this.branding.set(brand);
      this.applyTheme(brand);
      return brand;
    } catch (error: unknown) {
      console.error('No se pudo cargar la identidad del negocio:', error);
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateBranding(updates: BusinessBrandingUpdate): Promise<boolean> {
    const current = this.branding();
    if (!current.id) {
      this.toast.error('No se ha cargado el negocio que se quiere configurar.');
      return false;
    }

    try {
      const { data, error } = await this.supabase.rpc('update_business_branding', {
        p_business_id: current.id,
        p_name: updates.name,
        p_business_type: updates.business_type,
        p_logo_url: updates.logo_url || null,
        p_primary_color: updates.primary_color,
        p_secondary_color: updates.secondary_color,
      });
      if (error) throw error;
      if (!data) throw new Error('Supabase no devolvió la identidad actualizada.');

      const brand = data as BusinessBranding;
      this.branding.set(brand);
      this.applyTheme(brand);
      this.toast.success('La identidad del negocio se actualizó.');
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido de Supabase.';
      console.error('No se pudo guardar la identidad del negocio:', error);
      this.toast.error(message, 'No se pudo guardar la configuración');
      return false;
    }
  }

  async uploadLogo(file: File): Promise<string | null> {
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensionByType[file.type];
    if (!extension) {
      this.toast.error('El logo debe ser una imagen JPG, PNG o WebP.');
      return null;
    }
    if (file.size > 3 * 1024 * 1024) {
      this.toast.error('El logo no puede superar los 3 MB.');
      return null;
    }

    const businessId = this.branding().id;
    if (!businessId) {
      this.toast.error('No se ha cargado el negocio para guardar su logo.');
      return null;
    }

    const path = `${businessId}/${crypto.randomUUID()}.${extension}`;
    try {
      const { error } = await this.supabase.storage
        .from('business-branding')
        .upload(path, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        });
      if (error) throw error;

      const { data: { publicUrl } } = this.supabase.storage
        .from('business-branding')
        .getPublicUrl(path);
      return publicUrl;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido de Supabase.';
      console.error('No se pudo subir el logo del negocio:', error);
      this.toast.error(message, 'No se pudo subir el logo');
      return null;
    }
  }

  private applyTheme(brand: BusinessBranding): void {
    const root = document.documentElement;
    root.style.setProperty('--business-primary', brand.primary_color);
    root.style.setProperty('--business-secondary', brand.secondary_color);
    root.style.setProperty('--business-on-primary', this.contrastingTextColor(brand.primary_color));
    root.style.setProperty('--business-on-secondary', this.contrastingTextColor(brand.secondary_color));
    root.style.setProperty('--business-primary-text', this.readableTextColor(brand.primary_color));
    root.style.setProperty('--business-secondary-text', this.readableTextColor(brand.secondary_color));
  }

  private contrastingTextColor(background: string): string {
    const luminance = this.relativeLuminance(this.parseHexColor(background));
    const contrastWithWhite = 1.05 / (luminance + 0.05);
    const contrastWithBlack = (luminance + 0.05) / 0.05;
    return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#000000';
  }

  private readableTextColor(color: string): string {
    const original = this.parseHexColor(color);
    const surface = this.parseHexColor(SURFACE_COLOR);
    if (this.contrastRatio(original, surface) >= MIN_TEXT_CONTRAST) return color;

    let lower = 0;
    let upper = 1;
    const darken = (amount: number): [number, number, number] => [
      Math.round(original[0] * (1 - amount)),
      Math.round(original[1] * (1 - amount)),
      Math.round(original[2] * (1 - amount)),
    ];
    for (let iteration = 0; iteration < 24; iteration++) {
      const amount = (lower + upper) / 2;
      if (this.contrastRatio(darken(amount), surface) >= MIN_TEXT_CONTRAST) {
        upper = amount;
      } else {
        lower = amount;
      }
    }

    let readable = darken(upper);
    while (this.contrastRatio(readable, surface) < MIN_TEXT_CONTRAST) {
      upper = Math.min(1, upper + 0.001);
      readable = darken(upper);
    }
    return `#${readable.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }

  private contrastRatio(first: [number, number, number], second: [number, number, number]): number {
    const firstLuminance = this.relativeLuminance(first);
    const secondLuminance = this.relativeLuminance(second);
    const lighter = Math.max(firstLuminance, secondLuminance);
    const darker = Math.min(firstLuminance, secondLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private relativeLuminance([red, green, blue]: [number, number, number]): number {
    const linearize = (channel: number): number => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
  }

  private parseHexColor(color: string): [number, number, number] {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
    if (!match) throw new Error(`El color "${color}" no tiene un formato hexadecimal válido.`);
    return [
      Number.parseInt(match[1], 16),
      Number.parseInt(match[2], 16),
      Number.parseInt(match[3], 16),
    ];
  }
}
