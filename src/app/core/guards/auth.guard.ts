import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { BusinessService } from '../services/business.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;

  if (auth.isAuthenticated() || auth.salonAccessEnabled()) {
    return true;
  }

  const business = inject(BusinessService);
  return router.parseUrl(business.loginPath());
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const business = inject(BusinessService);

  try {
    if (auth.session() && await auth.hasAdminAccessToCurrentBusiness()) {
      return true;
    }
  } catch (error) {
    console.error('No se pudo validar el administrador de este negocio:', error);
  }

  if (auth.isEmployee()) {
    return router.parseUrl(business.employeePath());
  }

  return router.parseUrl(business.loginPath());
};

export const employeeGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const business = inject(BusinessService);

  await auth.ready;
  try {
    if (await auth.refreshSalonAccess()) {
      return true;
    }
  } catch (error) {
    console.error('No se pudo validar el acceso al salón:', error);
  }

  if (auth.isAdmin()) {
    return router.parseUrl(business.adminPath());
  }

  return router.parseUrl(business.loginPath());
};
