import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
    title: 'Iniciar sesión | Control de Ventas',
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Dashboard | Control de Ventas',
  },
  {
    path: 'equipo',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/equipo/equipo.component').then((m) => m.EquipoComponent),
    title: 'Equipo | Control de Ventas',
  },
  {
    path: 'ventas',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/ventas/ventas.component').then((m) => m.VentasComponent),
    title: 'Ventas | Control de Ventas',
  },
  {
    path: 'clientes',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/clientes/clientes.component').then((m) => m.ClientesComponent),
    title: 'Clientes | Control de Ventas',
  },
  {
    path: 'productos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/productos/productos.component').then((m) => m.ProductosComponent),
    title: 'Productos | Control de Ventas',
  },
  {
    path: 'metas',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/metas/metas.component').then((m) => m.MetasComponent),
    title: 'Metas | Control de Ventas',
  },
  {
    path: 'datos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/datos/datos.component').then((m) => m.DatosComponent),
    title: 'Datos | Control de Ventas',
  },
  { path: '**', redirectTo: 'dashboard' },
];
