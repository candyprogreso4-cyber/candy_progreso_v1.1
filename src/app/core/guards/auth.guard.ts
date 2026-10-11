import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;

  if (auth.isAuthenticated() || auth.salonAccessEnabled()) {
    return true;
  }

  return router.parseUrl('/login');
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAdmin()) {
    return true;
  }

  if (auth.isEmployee()) {
    return router.parseUrl('/employee/tables');
  }

  return router.parseUrl('/login');
};

export const employeeGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;
  try {
    if (await auth.refreshSalonAccess()) {
      return true;
    }
  } catch (error) {
    console.error('No se pudo validar el acceso al salón:', error);
  }

  if (auth.isAdmin()) {
    return router.parseUrl('/admin/dashboard');
  }

  return router.parseUrl('/login');
};
