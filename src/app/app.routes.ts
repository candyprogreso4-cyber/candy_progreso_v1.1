import { Routes } from '@angular/router';
import { LoginComponent } from './core/auth/login.component';
import { authGuard, adminGuard, employeeGuard } from './core/guards/auth.guard';

export const routes: Routes = [
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
      {
        path: 'employees',
        loadComponent: () =>
          import('./admin/employees/admin-employees.component').then(
            (module) => module.AdminEmployeesComponent
          ),
      },
      { path: 'qr', redirectTo: 'employees', pathMatch: 'full' },
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
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
