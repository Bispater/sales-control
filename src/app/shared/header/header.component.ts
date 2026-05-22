import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatasetService } from '../../services/dataset.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  template: `
    <header class="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div class="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <a routerLink="/dashboard" class="flex items-center gap-2 shrink-0">
          <span class="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold">CV</span>
          <span class="font-bold text-slate-900 hidden lg:inline">Control de Ventas</span>
        </a>

        <nav class="flex items-center gap-1 overflow-x-auto">
          <a *ngFor="let tab of tabs"
             [routerLink]="tab.path"
             routerLinkActive="bg-slate-900 text-white"
             [routerLinkActiveOptions]="{ exact: false }"
             class="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition whitespace-nowrap">

            <svg *ngIf="tab.path === '/dashboard'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12 12 2.25 21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h7.5"/>
            </svg>

            <svg *ngIf="tab.path === '/equipo'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>
            </svg>

            <svg *ngIf="tab.path === '/ventas'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"/>
            </svg>

            <svg *ngIf="tab.path === '/clientes'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
            </svg>

            <svg *ngIf="tab.path === '/productos'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/>
            </svg>

            <svg *ngIf="tab.path === '/metas'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            </svg>

            <svg *ngIf="tab.path === '/datos'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/>
            </svg>

            {{ tab.label }}
          </a>
        </nav>

        <div class="flex items-center gap-2 shrink-0">
          <select
            *ngIf="datasetService.aniosDisponibles().length > 0"
            [ngModel]="datasetService.anioActivo()"
            (ngModelChange)="cambiarAnio($event)"
            class="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            title="Año del dataset"
          >
            <option *ngFor="let m of datasetService.aniosDisponibles()" [value]="m.anio">
              {{ m.anio }}
            </option>
          </select>

          <div *ngIf="authService.user() as u" class="relative">
            <button
              (click)="abierto.set(!abierto())"
              class="inline-flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 transition"
            >
              <img
                *ngIf="u.photoURL; else iniciales"
                [src]="u.photoURL"
                referrerpolicy="no-referrer"
                alt=""
                class="w-9 h-9 rounded-full object-cover"
              />
              <ng-template #iniciales>
                <span class="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold text-sm">
                  {{ inicialesUsuario(u.displayName || u.email || '?') }}
                </span>
              </ng-template>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
              </svg>
            </button>

            <div *ngIf="abierto()" class="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-100 p-3 z-40" (click)="$event.stopPropagation()">
              <div class="px-2 py-2 border-b border-slate-100 mb-2">
                <p class="text-sm font-semibold text-slate-900 truncate">{{ u.displayName || 'Usuario' }}</p>
                <p class="text-xs text-slate-500 truncate">{{ u.email }}</p>
              </div>
              <button
                (click)="cerrarSesion()"
                class="w-full text-left text-sm text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-md flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"/>
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div *ngIf="abierto()" (click)="abierto.set(false)" class="fixed inset-0 z-30"></div>
  `,
})
export class HeaderComponent {
  authService = inject(AuthService);
  datasetService = inject(DatasetService);
  private router = inject(Router);

  abierto = signal(false);
  private autoCargaIniciada = false;

  tabs = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/equipo', label: 'Equipo' },
    { path: '/ventas', label: 'Ventas' },
    { path: '/clientes', label: 'Clientes' },
    { path: '/productos', label: 'Productos' },
    { path: '/metas', label: 'Metas' },
    { path: '/datos', label: 'Datos' },
  ];

  constructor() {
    // El estado de autenticación de Firebase es asíncrono; reaccionamos cuando
    // el usuario aparece para auto-cargar el dataset preferido (año en curso).
    effect(() => {
      const user = this.authService.user();
      if (!user || this.autoCargaIniciada) return;
      this.autoCargaIniciada = true;
      this.autoCargar();
    });
  }

  private async autoCargar(): Promise<void> {
    const lista = await this.datasetService.listarAnios();
    if (lista.length === 0 || this.datasetService.anioActivo() !== null) return;
    const anioActual = new Date().getFullYear();
    const elegido =
      lista.find((a) => a.anio === anioActual) ??
      lista.reduce((a, b) => (a.ultimaCarga > b.ultimaCarga ? a : b));
    await this.datasetService.cargarAnio(elegido.anio);
  }

  async cambiarAnio(anio: number) {
    await this.datasetService.cargarAnio(Number(anio));
  }

  inicialesUsuario(s: string): string {
    const partes = s.split(/[\s@]+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
  }

  async cerrarSesion() {
    this.abierto.set(false);
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
