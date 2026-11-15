import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { SupabaseClientService } from '../services/supabase-client.service';
import { ToastService } from '../services/toast.service';
import { Employee, Profile } from '../models/pos.types';
import { BusinessService } from '../services/business.service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Supabase devolvió un error sin descripción. Revisa la consola del navegador.';
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly business = inject(BusinessService);
  private salonAccessRefreshTimer: ReturnType<typeof setInterval> | null = null;

  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly employee = signal<Employee | null>(null);
  readonly employeeSessionToken = signal<string | null>(null);
  readonly isPlatformAdministrator = signal(false);
  readonly salonAccessEnabled = signal(false);
  readonly isAuthReady = signal(false);
  readonly ready: Promise<void>;

  readonly isAuthenticated = computed(() => !!this.session() || !!this.employee());
  readonly isAdmin = computed(() => this.profile()?.role === 'admin');
  readonly isEmployee = computed(
    () => this.profile()?.role === 'employee' || !!this.employee()
  );

  readonly currentUserName = computed(() => {
    if (this.isAdmin() && this.profile()) return this.profile()!.full_name;
    if (this.employee()) return this.employee()!.full_name;
    if (this.profile()) return this.profile()!.full_name;
    return 'Invitado';
  });

  constructor() {
    this.ready = this.initAuth();
  }

  private async initAuth(): Promise<void> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      this.session.set(session);

      const startupTasks: Promise<unknown>[] = [];
      if (this.business.branding().id) {
        startupTasks.push(this.refreshSalonAccess());
      }
      if (session?.user) {
        startupTasks.push(
          this.loadUserProfile(session.user.id).catch((err: unknown) => {
            console.error('No se pudo cargar el perfil de Supabase:', err);
          })
        );
      }
      await Promise.all(startupTasks);
      this.startSalonAccessMonitoring();

      this.supabase.auth.onAuthStateChange((_event, newSession) => {
        this.session.set(newSession);
        if (!newSession) {
          this.profile.set(null);
          return;
        }

        setTimeout(() => {
          void this.refreshUserProfile(newSession.user.id);
        }, 0);
      });
    } catch (err) {
      console.error('Error al inicializar sesión:', err);
    } finally {
      this.isAuthReady.set(true);
    }
  }

  async loadUserProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      this.profile.set(null);
      return null;
    }

    const profile: Profile = {
      id: data.id,
      full_name: data.full_name,
      role: data.role as 'admin' | 'employee',
      phone: data.phone,
      is_active: data.is_active,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
    this.profile.set(profile);
    return profile;
  }

  async signInAdmin(email: string, password: string): Promise<boolean> {
    let signedInSession: Session | null = null;
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        this.toast.error(
          error.message.includes('Invalid login')
            ? 'Credenciales incorrectas. Verifica correo y contraseña.'
            : error.message,
          'Error de acceso'
        );
        return false;
      }

      if (!data.session) {
        this.toast.error(
          'Supabase no devolvió una sesión. Verifica que el usuario exista y esté confirmado en Authentication → Users.',
          'No se inició la sesión'
        );
        return false;
      }

      signedInSession = data.session;
      this.session.set(data.session);
      const profile = await this.loadUserProfile(data.session.user.id);
      if (!profile || !profile.is_active) {
        await this.endRejectedAdminSession();
        this.toast.error(
          'No se encontró un perfil activo para esta cuenta. Verifica public.profiles en Supabase.',
          'Acceso de administrador denegado'
        );
        return false;
      }

      const { data: platformAdmin, error: platformAdminError } =
        await this.supabase.rpc('is_platform_admin');
      if (platformAdminError) throw platformAdminError;

      let businessAdmin = false;
      const isPlatformLogin = this.router.url.startsWith('/platform/login');
      if (!isPlatformLogin && this.business.branding().id) {
        const { data, error: businessAdminError } = await this.supabase.rpc('is_business_admin', {
          p_business_id: this.business.branding().id,
        });
        if (businessAdminError) throw businessAdminError;
        businessAdmin = data === true;
      }

      if (businessAdmin !== true && platformAdmin !== true) {
        await this.endRejectedAdminSession();
        this.toast.error(
          'Esta cuenta no administra este negocio. Verifica sus permisos en Supabase.',
          'Acceso de administrador denegado'
        );
        return false;
      }

      this.isPlatformAdministrator.set(platformAdmin === true);
      if (profile.role !== 'admin') {
        this.profile.set({ ...profile, role: 'admin' });
      }
      this.toast.success(`Bienvenido de vuelta, ${profile.full_name}!`);
      await this.router.navigate([
        platformAdmin === true ? '/platform/businesses' : this.business.adminPath(),
      ]);
      return true;
    } catch (err: unknown) {
      if (signedInSession) await this.endRejectedAdminSession();
      console.error('Error durante el inicio de sesión del administrador:', err);
      this.toast.error(getErrorMessage(err), 'Fallo de autenticación');
      return false;
    }
  }

  async refreshSalonAccess(): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('get_business_salon_access', {
      p_slug: this.business.branding().slug,
      p_session_token: this.employeeSessionToken(),
    });
    if (error) throw error;

    const enabled = data?.enabled === true;
    this.salonAccessEnabled.set(enabled);
    this.employeeSessionToken.set(enabled ? data.session_token ?? null : null);
    if (!enabled) {
      this.employee.set(null);
      return false;
    }

    const sharedEmployee = data.employee;
    if (!sharedEmployee?.id) {
      throw new Error('El acceso al salón está habilitado pero no se configuró el usuario compartido.');
    }

    this.employee.set({
      id: sharedEmployee.id,
      identification: sharedEmployee.identification,
      full_name: sharedEmployee.full_name,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    return true;
  }

  async setSalonAccess(enabled: boolean): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('set_business_salon_access', {
        p_slug: this.business.branding().slug,
        p_enabled: enabled,
      });
      if (error) throw error;
      if (!data?.success || data.enabled !== enabled) {
        throw new Error(data?.message || 'No fue posible actualizar el acceso al salón.');
      }

      this.salonAccessEnabled.set(enabled);
      this.employeeSessionToken.set(enabled ? data.session_token ?? null : null);
      if (enabled) {
        if (!data.employee?.id) {
          throw new Error('Supabase no devolvió el usuario compartido del salón.');
        }
        this.employee.set({
          id: data.employee.id,
          identification: data.employee.identification,
          full_name: data.employee.full_name,
          is_active: true,
          created_at: new Date().toISOString(),
        });
      } else {
        this.employee.set(null);
      }

      this.toast.success(
        enabled ? 'Acceso al salón habilitado para esta jornada.' : 'Acceso al salón cerrado.'
      );
      return true;
    } catch (err: unknown) {
      this.toast.error(getErrorMessage(err), 'No se pudo cambiar el acceso al salón');
      return false;
    }
  }

  async enterSalonMode(): Promise<boolean> {
    try {
      if (!(await this.refreshSalonAccess())) {
        this.toast.warning('El administrador todavía no ha habilitado el acceso al salón.');
        return false;
      }
      await this.router.navigate([this.business.employeePath()]);
      return true;
    } catch (err: unknown) {
      this.toast.error(getErrorMessage(err), 'No se pudo verificar el acceso al salón');
      return false;
    }
  }

  private startSalonAccessMonitoring(): void {
    if (this.salonAccessRefreshTimer) clearInterval(this.salonAccessRefreshTimer);
    this.salonAccessRefreshTimer = setInterval(() => {
      if (!this.salonAccessEnabled()) return;
      void this.refreshSalonAccess()
        .then((enabled) => {
          if (!enabled && this.router.url.includes('/employee/')) {
            this.toast.info('El administrador cerró el acceso al salón.');
            void this.router.navigate([
              this.isAdmin() ? this.business.adminPath() : this.business.loginPath(),
            ]);
          }
        })
        .catch((error: unknown) => {
          console.error('No se pudo verificar el acceso de la jornada:', error);
        });
    }, 15_000);
  }

  private async refreshUserProfile(userId: string): Promise<void> {
    try {
      await this.loadUserProfile(userId);
    } catch (err) {
      console.error('No se pudo actualizar el perfil después del cambio de sesión:', err);
    }
  }

  private async endRejectedAdminSession(): Promise<void> {
    const { error } = await this.supabase.auth.signOut({ scope: 'local' });
    if (error) {
      console.error('No se pudo cerrar la sesión sin permisos de administrador:', error);
    }
    this.session.set(null);
    this.profile.set(null);
    this.isPlatformAdministrator.set(false);
  }

  clearEmployeeSession(): void {
    this.employee.set(null);
    this.employeeSessionToken.set(null);
    this.salonAccessEnabled.set(false);
  }

  async hasAdminAccessToCurrentBusiness(): Promise<boolean> {
    if (!this.business.branding().id) return false;
    const [{ data: businessAdmin, error: businessError }, { data: platformAdmin, error: platformError }] =
      await Promise.all([
        this.supabase.rpc('is_business_admin', { p_business_id: this.business.branding().id }),
        this.supabase.rpc('is_platform_admin'),
      ]);
    if (businessError) throw businessError;
    if (platformError) throw platformError;
    this.isPlatformAdministrator.set(platformAdmin === true);
    const allowed = businessAdmin === true || platformAdmin === true;
    const profile = this.profile();
    if (profile && profile.is_active && profile.role !== (allowed ? 'admin' : 'employee')) {
      this.profile.set({ ...profile, role: allowed ? 'admin' : 'employee' });
    }
    return allowed;
  }

  async hasPlatformAdminAccess(): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('is_platform_admin');
    if (error) throw error;
    this.isPlatformAdministrator.set(data === true);
    const profile = this.profile();
    if (profile && profile.is_active && profile.role !== (data === true ? 'admin' : 'employee')) {
      this.profile.set({ ...profile, role: data === true ? 'admin' : 'employee' });
    }
    return data === true;
  }

  async signOut(scope: 'employee' | 'all' = 'all'): Promise<void> {
    try {
      if (scope === 'employee') {
        this.toast.info('Has vuelto a la pantalla de acceso. El salón seguirá disponible mientras el administrador lo mantenga abierto.');
        await this.router.navigate([
          this.isAdmin() ? this.business.adminPath() : this.business.loginPath(),
        ]);
        return;
      }

      if (this.session()) {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
      }
      this.clearEmployeeSession();
      this.profile.set(null);
      this.session.set(null);
      this.isPlatformAdministrator.set(false);
      this.toast.info('Sesión finalizada correctamente.');
      await this.router.navigate([this.business.loginPath()]);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      this.toast.error(getErrorMessage(err), 'Error al cerrar sesión');
      this.clearEmployeeSession();
      await this.router.navigate([this.business.loginPath()]);
    }
  }
}
