import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { PlatformBusinessesComponent } from './platform-businesses.component';
import { SupabaseClientService } from '../../core/services/supabase-client.service';

describe('PlatformBusinessesComponent', () => {
  const activeBusiness = {
    id: 'business-1',
    name: 'Café Central',
    slug: 'cafe-central',
    business_type: 'Cafetería',
    is_active: true,
  };
  let businesses: typeof activeBusiness[];
  let supabase: {
    rpc: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    storage: { from: ReturnType<typeof vi.fn> };
    auth: { signOut: ReturnType<typeof vi.fn> };
  };
  let fixture: ComponentFixture<PlatformBusinessesComponent>;

  beforeEach(async () => {
    businesses = [activeBusiness, { ...activeBusiness, id: 'business-2', slug: 'inactivo', is_active: false }];
    const businessQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(async () => ({ data: businesses, error: null })),
    };
    const storageBucket = {
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    supabase = {
      rpc: vi.fn(),
      from: vi.fn().mockReturnValue(businessQuery),
      storage: { from: vi.fn().mockReturnValue(storageBucket) },
      auth: { signOut: vi.fn() },
    };

    await TestBed.configureTestingModule({
      imports: [PlatformBusinessesComponent],
      providers: [
        { provide: SupabaseClientService, useValue: { instance: supabase } },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlatformBusinessesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('lists inactive businesses for platform management', () => {
    const component = fixture.componentInstance;

    expect(component.businesses().map((business) => business.slug)).toEqual([
      'cafe-central',
      'inactivo',
    ]);
  });

  it('creates a business through the platform RPC and shows its access slug', async () => {
    const component = fixture.componentInstance;
    component.name = 'Nueva Tienda';
    component.businessType = 'Cafetería';
    component.slug = 'nueva-tienda';
    component.ownerEmail = 'admin@example.com';
    supabase.rpc.mockResolvedValueOnce({
      data: { slug: 'nueva-tienda' },
      error: null,
    });

    await component.createBusiness();

    expect(supabase.rpc).toHaveBeenCalledWith('create_business', {
      p_name: 'Nueva Tienda',
      p_slug: 'nueva-tienda',
      p_business_type: 'Cafetería',
      p_owner_email: 'admin@example.com',
    });
    expect(component.createdBusinessSlug()).toBe('nueva-tienda');
  });

  it('shows a clear error when the business slug is already taken', async () => {
    const component = fixture.componentInstance;
    component.name = 'Otra Tienda';
    component.businessType = 'Cafetería';
    component.slug = 'cafe-central';
    component.ownerEmail = 'admin@example.com';
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    await component.createBusiness();

    expect(component.error()).toContain('identificador URL ya está en uso');
  });

  it('displays the message returned by Supabase when business creation fails', async () => {
    const component = fixture.componentInstance;
    component.name = 'Nueva Tienda';
    component.businessType = 'Cafetería';
    component.slug = 'nueva-tienda';
    component.ownerEmail = 'admin@example.com';
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'El usuario no tiene permisos de plataforma.' },
    });

    await component.createBusiness();

    expect(component.error()).toBe('El usuario no tiene permisos de plataforma.');
  });

  it('changes business activation through the platform RPC', async () => {
    const component = fixture.componentInstance;
    supabase.rpc.mockResolvedValueOnce({
      data: { id: activeBusiness.id, slug: activeBusiness.slug, is_active: false },
      error: null,
    });

    await component.toggleBusinessStatus(activeBusiness);

    expect(supabase.rpc).toHaveBeenCalledWith('set_business_active', {
      p_business_id: activeBusiness.id,
      p_is_active: false,
    });
  });

  it('updates a business through the platform RPC', async () => {
    const component = fixture.componentInstance;
    component.startEditing(activeBusiness);
    component.editName = 'Café Nuevo';
    component.editBusinessType = 'Panadería';
    component.editSlug = 'cafe-nuevo';
    supabase.rpc.mockResolvedValueOnce({
      data: { id: activeBusiness.id, slug: 'cafe-nuevo' },
      error: null,
    });

    await component.saveBusiness(activeBusiness);

    expect(supabase.rpc).toHaveBeenCalledWith('update_platform_business', {
      p_business_id: activeBusiness.id,
      p_name: 'Café Nuevo',
      p_slug: 'cafe-nuevo',
      p_business_type: 'Panadería',
    });
    expect(component.editingBusinessId()).toBe('');
  });

  it('requires the exact slug before permanently deleting a business', async () => {
    const component = fixture.componentInstance;
    component.beginDelete(activeBusiness);
    component.deleteSlugConfirmation = 'wrong-slug';

    await component.deleteBusiness(activeBusiness);

    expect(supabase.rpc).not.toHaveBeenCalled();

    component.deleteSlugConfirmation = activeBusiness.slug;
    supabase.rpc.mockResolvedValueOnce({
      data: { id: activeBusiness.id, deleted: true },
      error: null,
    });

    await component.deleteBusiness(activeBusiness);

    expect(supabase.rpc).toHaveBeenCalledWith('delete_platform_business', {
      p_business_id: activeBusiness.id,
      p_confirmation_slug: activeBusiness.slug,
    });
    expect(component.deleteConfirmationBusinessId()).toBe('');
  });
});
