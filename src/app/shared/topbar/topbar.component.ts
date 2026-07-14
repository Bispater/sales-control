import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatasetService } from '../../services/dataset.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6">
      <!-- Hamburguesa (móvil) -->
      <button (click)="alternarMenu.emit()" class="lg:hidden w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
        </svg>
      </button>

      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-900 truncate">
          {{ saludo() }}<span *ngIf="nombreCorto() as n">, {{ n }}</span> 👋
        </p>
        <p class="text-xs text-slate-500 hidden sm:block">Panel de control de ventas</p>
      </div>

      <div class="flex items-center gap-2 ml-auto shrink-0">
        <!-- Selector de año -->
        <select
          *ngIf="datasetService.aniosDisponibles().length > 0"
          [ngModel]="datasetService.anioActivo()"
          (ngModelChange)="cambiarAnio($event)"
          class="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          title="Año del dataset"
        >
          <option *ngFor="let m of datasetService.aniosDisponibles()" [value]="m.anio">{{ m.anio }}</option>
        </select>

        <!-- Notificaciones (visual) -->
        <button class="relative w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" title="Notificaciones">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/>
          </svg>
          <span class="absolute top-1.5 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
        </button>

        <!-- Usuario -->
        <div *ngIf="authService.user() as u" class="relative">
          <button (click)="abierto.set(!abierto())" class="inline-flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-100 transition">
            <img *ngIf="u.photoURL; else iniciales" [src]="u.photoURL" referrerpolicy="no-referrer" alt="" class="w-9 h-9 rounded-full object-cover" />
            <ng-template #iniciales>
              <span class="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold text-sm">
                {{ inicialesUsuario(u.displayName || u.email || '?') }}
              </span>
            </ng-template>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-500 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
            </svg>
          </button>

          <div *ngIf="abierto()" class="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-100 p-3 z-40" (click)="$event.stopPropagation()">
            <div class="px-2 py-2 border-b border-slate-100 mb-2">
              <p class="text-sm font-semibold text-slate-900 truncate">{{ u.displayName || 'Usuario' }}</p>
              <p class="text-xs text-slate-500 truncate">{{ u.email }}</p>
            </div>
            <button (click)="cerrarSesion()" class="w-full text-left text-sm text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-md flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"/>
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </header>

    <div *ngIf="abierto()" (click)="abierto.set(false)" class="fixed inset-0 z-10"></div>
  `,
})
export class TopbarComponent {
  @Output() alternarMenu = new EventEmitter<void>();

  authService = inject(AuthService);
  datasetService = inject(DatasetService);
  private router = inject(Router);

  abierto = signal(false);
  private autoCargaIniciada = false;

  constructor() {
    // Auto-carga del dataset preferido cuando aparece el usuario (Firebase async).
    effect(() => {
      const user = this.authService.user();
      if (!user || this.autoCargaIniciada) return;
      this.autoCargaIniciada = true;
      this.autoCargar();
    });
  }

  saludo(): string {
    const h = new Date().getHours();
    if (h < 12) return '¡Buenos días';
    if (h < 20) return '¡Buenas tardes';
    return '¡Buenas noches';
  }

  nombreCorto(): string {
    const u = this.authService.user();
    const n = u?.displayName || u?.email || '';
    return n.split(/[\s@]+/)[0] ?? '';
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
