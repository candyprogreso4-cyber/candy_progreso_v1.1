import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BusinessService } from './business.service';
import { SupabaseClientService } from './supabase-client.service';
import { ToastService } from './toast.service';

describe('BusinessService branding contrast', () => {
  const supabase = { rpc: vi.fn() };

  beforeEach(() => {
    supabase.rpc.mockReset();
    TestBed.configureTestingModule({
      providers: [
        BusinessService,
        { provide: SupabaseClientService, useValue: { instance: supabase } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--business-primary');
    document.documentElement.style.removeProperty('--business-secondary');
    document.documentElement.style.removeProperty('--business-on-primary');
    document.documentElement.style.removeProperty('--business-on-secondary');
    document.documentElement.style.removeProperty('--business-primary-text');
    document.documentElement.style.removeProperty('--business-secondary-text');
    document.getElementById('app-favicon')?.remove();
  });

  it('chooses readable foregrounds for both bright and dark brand colors', async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        id: 'business-1',
        name: 'Tienda',
        slug: 'tienda',
        business_type: 'Comercio',
        logo_url: null,
        primary_color: '#FDE68A',
        secondary_color: '#123456',
      },
      error: null,
    });

    await TestBed.inject(BusinessService).loadBranding('tienda');

    const root = document.documentElement.style;
    expect(root.getPropertyValue('--business-on-primary')).toBe('#000000');
    expect(root.getPropertyValue('--business-on-secondary')).toBe('#ffffff');
    expect(contrastRatio(root.getPropertyValue('--business-primary-text'), '#fff7fe')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(root.getPropertyValue('--business-secondary-text'), '#fff7fe')).toBeGreaterThanOrEqual(4.5);
  });

  it('sets the current commerce logo as this page favicon and restores the platform icon', async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        id: 'business-1',
        name: 'Tienda',
        slug: 'tienda',
        business_type: 'Comercio',
        logo_url: 'https://example.supabase.co/storage/v1/object/public/branding/logo.png',
        primary_color: '#123456',
        secondary_color: '#654321',
      },
      error: null,
    });

    const business = TestBed.inject(BusinessService);
    await business.loadBranding('tienda');

    expect(document.querySelector<HTMLLinkElement>('#app-favicon')?.href)
      .toBe('https://example.supabase.co/storage/v1/object/public/branding/logo.png');

    business.resetPlatformBranding();

    expect(document.querySelector<HTMLLinkElement>('#app-favicon')?.getAttribute('href'))
      .toBe('/favicon.ico?v=20261121');
  });
});

function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
