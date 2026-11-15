import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { BusinessService } from '../services/business.service';
import { AuthService } from '../auth/auth.service';

export const businessContextGuard: CanActivateFn = async (route) => {
  const business = inject(BusinessService);
  const router = inject(Router);
  const slug = route.paramMap.get('businessSlug');

  if (!slug || !(await business.loadBranding(slug))) {
    return router.parseUrl('/not-found');
  }
  return true;
};

export const platformAdminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;

  if (!auth.session()) return router.parseUrl('/platform/login');
  try {
    return (await auth.hasPlatformAdminAccess())
      ? true
      : router.parseUrl('/platform/login');
  } catch (error) {
    console.error('No se pudo validar el acceso de plataforma:', error);
    return router.parseUrl('/platform/login');
  }
};
