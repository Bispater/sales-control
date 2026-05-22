import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RegistroVenta } from '../../models/dataset';
import { DatasetService } from '../../services/dataset.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';

const PAGE_SIZE = 24;

type Estado = 'Activo' | 'Nuevo' | 'Desactivo';

interface ResumenCliente {
  rut: string;
  nombre: string;
  email: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  facturacion: number;
  margen: number;
  margenPct: number;
  cantidadDocs: number;
  ticketPromedio: number;
  primerCompra: Date | null;
  ultimaCompra: Date | null;
  vendedorPrincipal: string;
  estado: Estado;
}

interface VentaCliente {
  producto: string;
  vendedor: string;
  fecha: Date | null;
  monto: number;
  documento: string;
}

interface ProductoCliente {
  nombre: string;
  cantidad: number;
  monto: number;
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent],
  template: `
    <div class="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Directorio de Clientes</h1>
        <p class="text-sm text-slate-500 mt-1">Gestión completa de la cartera de clientes</p>
      </div>
    </div>

    <ng-container *ngIf="dataset.cargando() || !listoParaCalcular(); else listo">
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-12 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <span class="inline-block w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
        <span>Cargando clientes...</span>
      </div>
    </ng-container>

    <ng-template #listo>
      <ng-container *ngIf="dataset.registros().length === 0; else ok">
        <app-empty-state
          titulo="Sin datos cargados"
          descripcion="Sube un CSV con tus ventas en la sección Datos para ver tus clientes."
          enlace="/datos"
          enlaceLabel="Ir a Datos"
        ></app-empty-state>
      </ng-container>

      <ng-template #ok>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-start justify-between">
            <div>
              <p class="text-sm text-slate-500">Total Clientes</p>
              <p class="text-3xl font-bold text-slate-900 mt-2">{{ kpis().total | number }}</p>
            </div>
            <span class="p-2 rounded-lg bg-slate-100 text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"/></svg>
            </span>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-start justify-between">
            <div>
              <p class="text-sm text-slate-500">Clientes Activos</p>
              <p class="text-3xl font-bold text-slate-900 mt-2">{{ kpis().activos | number }}</p>
            </div>
            <span class="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/></svg>
            </span>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-start justify-between">
            <div>
              <p class="text-sm text-slate-500">Clientes Nuevos</p>
              <p class="text-3xl font-bold text-slate-900 mt-2">{{ kpis().nuevos | number }}</p>
            </div>
            <span class="p-2 rounded-lg bg-sky-50 text-sky-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
            </span>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-start justify-between">
            <div>
              <p class="text-sm text-slate-500">Facturación Total</p>
              <p class="text-3xl font-bold text-slate-900 mt-2">{{ formatoCLP(kpis().facturacion) }}</p>
            </div>
            <span class="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/></svg>
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-[1fr_220px_220px] gap-3 mb-4">
          <div class="relative">
            <span class="absolute inset-y-0 left-3 flex items-center text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
            </span>
            <input
              [ngModel]="texto()"
              (ngModelChange)="texto.set($event); pagina.set(0)"
              placeholder="Buscar por nombre, email, RUT, comuna..."
              class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <select
            [ngModel]="estadoFiltro()"
            (ngModelChange)="estadoFiltro.set($event); pagina.set(0)"
            class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todos los estados</option>
            <option value="Activo">Activos</option>
            <option value="Nuevo">Nuevos</option>
            <option value="Desactivo">Desactivos</option>
          </select>
          <select
            [ngModel]="vendedorFiltro()"
            (ngModelChange)="vendedorFiltro.set($event); pagina.set(0)"
            class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todos los vendedores</option>
            <option *ngFor="let v of vendedoresOpciones()" [value]="v">{{ v }}</option>
          </select>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div *ngFor="let c of paginaActual()" class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex flex-col">
            <div class="flex items-start justify-between gap-3 mb-1">
              <div class="flex items-start gap-3 min-w-0">
                <span class="w-10 h-10 inline-flex items-center justify-center rounded-lg bg-sky-50 text-sky-600 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"/></svg>
                </span>
                <div class="min-w-0">
                  <p class="font-semibold text-slate-900 truncate" [title]="c.nombre">{{ c.nombre }}</p>
                  <p class="text-xs text-slate-500 truncate">{{ c.ciudad || c.comuna || c.rut }}</p>
                </div>
              </div>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    [class]="badgeClases(c.estado)">{{ c.estado }}</span>
            </div>

            <div class="text-xs text-slate-600 space-y-1.5 my-4">
              <p *ngIf="c.email" class="flex items-center gap-2 truncate">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/></svg>
                <span class="truncate" [title]="c.email">{{ c.email }}</span>
              </p>
              <p *ngIf="c.rut" class="flex items-center gap-2 truncate">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z"/></svg>
                {{ c.rut }}
              </p>
              <p *ngIf="c.direccion || c.comuna || c.ciudad" class="flex items-center gap-2 truncate">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg>
                <span class="truncate">{{ direccionResumen(c) }}</span>
              </p>
            </div>

            <div class="border-t border-slate-100 pt-3 text-sm space-y-1.5">
              <div class="flex justify-between">
                <span class="text-slate-500">Facturación</span>
                <span class="font-bold text-slate-900">{{ formatoCLP(c.facturacion) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Ventas</span>
                <span class="font-bold text-slate-900">{{ c.cantidadDocs | number }}</span>
              </div>
              <div class="flex justify-between" *ngIf="c.vendedorPrincipal">
                <span class="text-slate-500">Vendedor asignado</span>
                <span class="font-semibold text-slate-700 truncate ml-2">{{ c.vendedorPrincipal }}</span>
              </div>
              <div class="flex items-center gap-1 text-xs text-slate-500 pt-1" *ngIf="c.ultimaCompra">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>
                Última compra: {{ fechaCorta(c.ultimaCompra) }}
              </div>
            </div>

            <button (click)="abrir(c)" class="mt-4 w-full flex items-center justify-center gap-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 py-2 rounded-lg transition">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
              Ver Detalles
            </button>
          </div>
          <div *ngIf="paginaActual().length === 0" class="col-span-full text-center text-sm text-slate-400 py-12">
            No se encontraron clientes con los filtros aplicados.
          </div>
        </div>

        <div *ngIf="totalPaginas() > 1" class="flex items-center justify-between bg-white rounded-xl shadow-card border border-slate-100 p-4 mt-4">
          <button
            (click)="pagina.set(Math.max(0, pagina() - 1))"
            [disabled]="pagina() === 0"
            class="text-sm px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >Anterior</button>
          <span class="text-xs text-slate-500">
            Página {{ pagina() + 1 }} de {{ totalPaginas() }} · {{ filtrados().length | number }} clientes
          </span>
          <button
            (click)="pagina.set(Math.min(totalPaginas() - 1, pagina() + 1))"
            [disabled]="pagina() >= totalPaginas() - 1"
            class="text-sm px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >Siguiente</button>
        </div>
      </ng-template>
    </ng-template>

    <div *ngIf="seleccionado() as s" class="fixed inset-0 bg-slate-900/40 flex items-start justify-center p-4 z-50 overflow-y-auto" (click)="cerrar()">
      <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full mt-6" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between p-5 border-b border-slate-100">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-12 h-12 inline-flex items-center justify-center rounded-lg bg-sky-50 text-sky-600 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"/></svg>
            </span>
            <div class="min-w-0">
              <h2 class="text-lg font-bold text-slate-900 truncate" [title]="s.nombre">{{ s.nombre }}</h2>
              <p class="text-xs text-slate-500 truncate">{{ s.ciudad || s.comuna || s.rut }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[11px] font-semibold px-2.5 py-1 rounded-full" [class]="badgeClases(s.estado)">{{ s.estado }}</span>
            <button (click)="cerrar()" class="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div class="p-5 space-y-6">
          <section>
            <h4 class="text-sm font-semibold text-slate-900 mb-3">Información de Contacto</h4>
            <div class="space-y-2 text-sm">
              <div class="flex items-center gap-2" *ngIf="s.email">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/></svg>
                <a [href]="'mailto:' + s.email" class="text-sky-600 hover:underline truncate">{{ s.email }}</a>
              </div>
              <div class="flex items-center gap-2" *ngIf="s.rut">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"/></svg>
                <span class="text-slate-700">{{ s.rut }}</span>
              </div>
              <div class="flex items-start gap-2" *ngIf="s.direccion || s.comuna || s.ciudad">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg>
                <span class="text-slate-700">{{ direccionCompleta(s) }}</span>
              </div>
            </div>
          </section>

          <section>
            <h4 class="text-sm font-semibold text-slate-900 mb-3">Resumen de Ventas</h4>
            <div class="grid grid-cols-3 gap-3">
              <div class="border border-slate-100 rounded-lg p-4 text-center">
                <p class="text-xs text-slate-500">Total Facturado</p>
                <p class="text-base font-bold text-slate-900 mt-1">{{ formatoCLP(s.facturacion) }}</p>
              </div>
              <div class="border border-slate-100 rounded-lg p-4 text-center">
                <p class="text-xs text-slate-500">Total Ventas</p>
                <p class="text-base font-bold text-slate-900 mt-1">{{ s.cantidadDocs | number }}</p>
              </div>
              <div class="border border-slate-100 rounded-lg p-4 text-center">
                <p class="text-xs text-slate-500">Ticket Promedio</p>
                <p class="text-base font-bold text-slate-900 mt-1">{{ formatoCLP(s.ticketPromedio) }}</p>
              </div>
            </div>
          </section>

          <section>
            <h4 class="text-sm font-semibold text-slate-900 mb-3">Información Adicional</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <div>
                <p class="text-xs text-slate-500">Vendedor Asignado</p>
                <p class="text-slate-800 mt-0.5">{{ s.vendedorPrincipal || '—' }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-500">Fecha de Registro</p>
                <p class="text-slate-800 mt-0.5 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>
                  {{ fechaLarga(s.primerCompra) || '—' }}
                </p>
              </div>
              <div>
                <p class="text-xs text-slate-500">Última Compra</p>
                <p class="text-slate-800 mt-0.5 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>
                  {{ fechaLarga(s.ultimaCompra) || '—' }}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h4 class="text-sm font-semibold text-slate-900 mb-3">Top 10 Productos · Más Comprados</h4>
            <div *ngIf="topProductos().length === 0" class="text-sm text-slate-400">Sin compras registradas.</div>
            <div class="space-y-2">
              <div *ngFor="let p of topProductos(); let i = index" class="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="w-6 h-6 inline-flex items-center justify-center rounded-full bg-sky-600 text-white text-xs font-bold shrink-0">{{ i + 1 }}</span>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-slate-900 truncate" [title]="p.nombre">{{ p.nombre }}</p>
                    <p class="text-xs text-slate-500">{{ p.cantidad | number }} unidades · {{ formatoCLP(p.monto) }}</p>
                  </div>
                </div>
                <span class="text-sm font-bold text-slate-700 shrink-0 ml-3">{{ p.cantidad | number }}</span>
              </div>
            </div>
          </section>

          <section>
            <h4 class="text-sm font-semibold text-slate-900 mb-3">Historial de Ventas</h4>
            <div *ngIf="historial().length === 0" class="text-sm text-slate-400">Sin compras registradas.</div>
            <div class="space-y-2">
              <div *ngFor="let v of historial()" class="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-white text-slate-500 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-slate-900 truncate" [title]="v.producto">{{ v.producto }}</p>
                    <p class="text-xs text-slate-500 truncate">{{ v.vendedor }} · {{ fechaCorta(v.fecha) }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-sm font-bold text-slate-900">{{ formatoCLP(v.monto) }}</span>
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Completada</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class ClientesComponent {
  dataset = inject(DatasetService);
  Math = Math;
  pageSize = PAGE_SIZE;

  listoParaCalcular = signal(false);

  texto = signal('');
  estadoFiltro = signal<'' | Estado>('');
  vendedorFiltro = signal('');
  pagina = signal(0);
  seleccionado = signal<ResumenCliente | null>(null);

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);
  }

  todosClientes = computed<ResumenCliente[]>(() => {
    const hoy = this.fechaReferencia();
    const map = new Map<string, ResumenCliente & { _vendedores: Map<string, number> }>();
    for (const r of this.dataset.registros()) {
      const id = (r.clienteRut?.trim() || r.nombreCliente?.trim() || '').toUpperCase();
      if (!id) continue;
      let prev = map.get(id);
      if (!prev) {
        prev = {
          rut: r.clienteRut?.trim() || '',
          nombre: r.nombreCliente?.trim() || id,
          email: r.emailCliente?.trim() || '',
          direccion: r.clienteDireccion?.trim() || '',
          comuna: r.clienteComuna?.trim() || '',
          ciudad: r.clienteCiudad?.trim() || '',
          facturacion: 0,
          margen: 0,
          margenPct: 0,
          cantidadDocs: 0,
          ticketPromedio: 0,
          primerCompra: null,
          ultimaCompra: null,
          vendedorPrincipal: '',
          estado: 'Desactivo',
          _vendedores: new Map<string, number>(),
        };
        map.set(id, prev);
      }
      prev.facturacion += r.ventaTotalBruta;
      prev.margen += r.margen;
      const fecha = this.parsearFecha(r);
      if (fecha) {
        if (!prev.primerCompra || fecha < prev.primerCompra) prev.primerCompra = fecha;
        if (!prev.ultimaCompra || fecha > prev.ultimaCompra) prev.ultimaCompra = fecha;
      }
      if (r.vendedor?.trim()) {
        const v = r.vendedor.trim();
        prev._vendedores.set(v, (prev._vendedores.get(v) ?? 0) + r.ventaTotalBruta);
      }
    }

    // cantidad de ventas = documentos únicos
    const docsPorCliente = new Map<string, Set<string>>();
    for (const r of this.dataset.registros()) {
      const id = (r.clienteRut?.trim() || r.nombreCliente?.trim() || '').toUpperCase();
      if (!id || !r.numeroDocumento) continue;
      let set = docsPorCliente.get(id);
      if (!set) { set = new Set(); docsPorCliente.set(id, set); }
      set.add(r.numeroDocumento + '|' + r.sucursal);
    }

    const arr = Array.from(map.entries()).map(([id, c]) => {
      c.margenPct = c.facturacion > 0 ? (c.margen / c.facturacion) * 100 : 0;
      c.cantidadDocs = docsPorCliente.get(id)?.size ?? 0;
      c.ticketPromedio = c.cantidadDocs > 0 ? c.facturacion / c.cantidadDocs : c.facturacion;
      let topVendedor = '';
      let max = 0;
      c._vendedores.forEach((v, k) => {
        if (v > max) { max = v; topVendedor = k; }
      });
      c.vendedorPrincipal = topVendedor;
      c.estado = this.calcularEstado(c.primerCompra, c.ultimaCompra, hoy);
      delete (c as { _vendedores?: Map<string, number> })._vendedores;
      return c as ResumenCliente;
    });
    arr.sort((a, b) => b.facturacion - a.facturacion);
    return arr;
  });

  filtrados = computed<ResumenCliente[]>(() => {
    const t = this.texto().toLowerCase().trim();
    const estado = this.estadoFiltro();
    const vendedor = this.vendedorFiltro();
    return this.todosClientes().filter((c) => {
      if (estado && c.estado !== estado) return false;
      if (vendedor && c.vendedorPrincipal !== vendedor) return false;
      if (t) {
        const hay =
          c.nombre?.toLowerCase().includes(t) ||
          c.rut?.toLowerCase().includes(t) ||
          c.email?.toLowerCase().includes(t) ||
          c.comuna?.toLowerCase().includes(t) ||
          c.ciudad?.toLowerCase().includes(t);
        if (!hay) return false;
      }
      return true;
    });
  });

  vendedoresOpciones = computed<string[]>(() => {
    const set = new Set<string>();
    this.todosClientes().forEach((c) => { if (c.vendedorPrincipal) set.add(c.vendedorPrincipal); });
    return Array.from(set).sort();
  });

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / PAGE_SIZE)));

  paginaActual = computed(() => {
    const inicio = this.pagina() * PAGE_SIZE;
    return this.filtrados().slice(inicio, inicio + PAGE_SIZE);
  });

  kpis = computed(() => {
    const lista = this.todosClientes();
    let activos = 0, nuevos = 0, facturacion = 0;
    for (const c of lista) {
      if (c.estado === 'Activo') activos++;
      else if (c.estado === 'Nuevo') nuevos++;
      facturacion += c.facturacion;
    }
    return { total: lista.length, activos, nuevos, facturacion };
  });

  historial = computed<VentaCliente[]>(() => {
    const c = this.seleccionado();
    if (!c) return [];
    const items: VentaCliente[] = [];
    for (const r of this.dataset.registros()) {
      const id = (r.clienteRut?.trim() || r.nombreCliente?.trim() || '').toUpperCase();
      const clienteId = (c.rut || c.nombre).toUpperCase();
      if (id !== clienteId) continue;
      items.push({
        producto: (r.producto || '').trim() || 'Sin producto',
        vendedor: (r.vendedor || '').trim(),
        fecha: this.parsearFecha(r),
        monto: r.ventaTotalBruta,
        documento: r.numeroDocumento,
      });
    }
    items.sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));
    return items.slice(0, 20);
  });

  topProductos = computed<ProductoCliente[]>(() => {
    const c = this.seleccionado();
    if (!c) return [];
    const map = new Map<string, ProductoCliente>();
    for (const r of this.dataset.registros()) {
      const id = (r.clienteRut?.trim() || r.nombreCliente?.trim() || '').toUpperCase();
      const clienteId = (c.rut || c.nombre).toUpperCase();
      if (id !== clienteId) continue;
      const nombre = (r.producto || '').trim();
      if (!nombre) continue;
      let prev = map.get(nombre);
      if (!prev) { prev = { nombre, cantidad: 0, monto: 0 }; map.set(nombre, prev); }
      prev.cantidad += r.cantidad || 0;
      prev.monto += r.ventaTotalBruta;
    }
    return Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
  });

  abrir(c: ResumenCliente) { this.seleccionado.set(c); }
  cerrar() { this.seleccionado.set(null); }

  badgeClases(e: Estado): string {
    if (e === 'Activo') return 'bg-emerald-100 text-emerald-700';
    if (e === 'Nuevo') return 'bg-sky-100 text-sky-700';
    return 'bg-slate-200 text-slate-600';
  }

  direccionResumen(c: ResumenCliente): string {
    const partes = [c.direccion, c.comuna, c.ciudad].filter((x) => x && x.length > 0);
    return partes.join(', ');
  }

  direccionCompleta(c: ResumenCliente): string {
    return this.direccionResumen(c) || '—';
  }

  formatoCLP(n: number): string {
    return '$' + (Math.round(n) || 0).toLocaleString('es-CL');
  }

  fechaCorta(d: Date | null): string {
    if (!d) return '—';
    return d.getDate() + ' ' + MESES_CORTO[d.getMonth()] + ' ' + d.getFullYear();
  }

  fechaLarga(d: Date | null): string {
    if (!d) return '';
    return d.getDate() + ' de ' + MESES_ES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  // Punto de referencia "hoy". Si el dataset es de un año pasado, usamos el
  // último día con compras dentro del dataset para que los estados sigan
  // siendo significativos al revisar históricos.
  private fechaReferencia(): Date {
    const hoy = new Date();
    const anio = this.dataset.anioActivo();
    if (anio == null) return hoy;
    if (anio === hoy.getFullYear()) return hoy;
    // Año pasado o futuro respecto al actual: tomar último día con datos
    let maxTs = 0;
    for (const r of this.dataset.registros()) {
      const f = this.parsearFecha(r);
      if (f && f.getTime() > maxTs) maxTs = f.getTime();
    }
    return maxTs > 0 ? new Date(maxTs) : new Date(anio, 11, 31);
  }

  private calcularEstado(primera: Date | null, ultima: Date | null, hoy: Date): Estado {
    if (!ultima) return 'Desactivo';
    const diasDesdeUltima = (hoy.getTime() - ultima.getTime()) / 86400000;
    const diasDesdePrimera = primera ? (hoy.getTime() - primera.getTime()) / 86400000 : Infinity;
    if (diasDesdePrimera <= 60) return 'Nuevo';
    if (diasDesdeUltima <= 180) return 'Activo';
    return 'Desactivo';
  }

  private parsearFecha(r: RegistroVenta): Date | null {
    if (r.anio && r.mes && r.dia) {
      return new Date(r.anio, r.mes - 1, r.dia);
    }
    const txt = (r.fechaHoraVenta || r.fechaEmision || '').trim();
    if (!txt) return null;
    const iso = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
    const dmy = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
    return null;
  }
}
