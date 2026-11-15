import { Routes } from '@angular/router';
import { LoginComponent } from './core/auth/login.component';
import { authGuard, adminGuard, employeeGuard } from './core/guards/auth.guard';
import { businessContextGuard, platformAdminGuard } from './core/guards/business.guard';

export const routes: Routes = [
  {
    path: 'platform',
    children: [
      { path: 'login', component: LoginComponent },
      {
        path: '',
        canActivate: [platformAdminGuard],
        children: [
          { path: '', redirectTo: 'businesses', pathMatch: 'full' },
          {
            path: 'businesses',
            loadComponent: () =>
              import('./platform/businesses/platform-businesses.component').then(
                (module) => module.PlatformBusinessesComponent
              ),
          },
        ],
      },
    ],
  },
  {
    path: 'not-found',
    loadComponent: () =>
      import('./shared/not-found.component').then((module) => module.NotFoundComponent),
  },
  {
    path: ':businessSlug',
    canActivate: [businessContextGuard],
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        component: LoginComponent,
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./admin/admin-layout.component').then((module) => module.AdminLayoutComponent),
        canActivate: [authGuard, adminGuard],
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./admin/dashboard/admin-dashboard.component').then(
                (module) => module.AdminDashboardComponent
              ),
          },
          {
            path: 'orders',
            loadComponent: () =>
              import('./admin/orders/admin-orders.component').then(
                (module) => module.AdminOrdersComponent
              ),
          },
          {
            path: 'payments',
            loadComponent: () =>
              import('./admin/payments/admin-payments.component').then(
                (module) => module.AdminPaymentsComponent
              ),
          },
          {
            path: 'products',
            loadComponent: () =>
              import('./admin/products/admin-products.component').then(
                (module) => module.AdminProductsComponent
              ),
          },
          { path: 'employees', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'qr', redirectTo: 'dashboard', pathMatch: 'full' },
          {
            path: 'cash',
            loadComponent: () =>
              import('./admin/cash/admin-cash.component').then(
                (module) => module.AdminCashComponent
              ),
          },
          {
            path: 'reports',
            loadComponent: () =>
              import('./admin/reports/admin-reports.component').then(
                (module) => module.AdminReportsComponent
              ),
          },
          {
            path: 'supplier-expenses',
            loadComponent: () =>
              import('./admin/supplier-expenses/admin-supplier-expenses.component').then(
                (module) => module.AdminSupplierExpensesComponent
              ),
          },
          {
            path: 'settings',
            loadComponent: () =>
              import('./admin/settings/business-settings.component').then(
                (module) => module.BusinessSettingsComponent
              ),
          },
        ],
      },
      {
        path: 'employee',
        loadComponent: () =>
          import('./employee/employee-layout.component').then(
            (module) => module.EmployeeLayoutComponent
          ),
        canActivate: [authGuard, employeeGuard],
        children: [
          { path: '', redirectTo: 'tables', pathMatch: 'full' },
          {
            path: 'tables',
            loadComponent: () =>
              import('./employee/tables/employee-tables.component').then(
                (module) => module.EmployeeTablesComponent
              ),
          },
          {
            path: 'menu',
            loadComponent: () =>
              import('./employee/menu/employee-menu.component').then(
                (module) => module.EmployeeMenuComponent
              ),
          },
          {
            path: 'orders',
            loadComponent: () =>
              import('./employee/orders/employee-orders.component').then(
                (module) => module.EmployeeOrdersComponent
              ),
          },
        ],
      },
    ],
  },
  {
    path: '',
    redirectTo: 'platform/login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'not-found',
  },
];
