import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { RegistroVenta } from '../../models/dataset';
import { DatasetService } from '../../services/dataset.service';
import { ClientesMaestroService } from '../../services/clientes-maestro.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';

Chart.register(...registerables);

const PAGE_SIZE = 24;

type Estado = 'Activo' | 'Nuevo' | 'Inactivo' | 'Bloqueado';

interface ResumenCliente {
  rut: string;
  nombre: string;
  email: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  // Datos de la ficha maestra (app móvil), cruzados por RUT.
  contacto: string;
  telefono: string;
  credito: number;
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

interface FacturaCliente {
  documento: string;
  vendedor: string;
  fecha: Date | null;
  monto: number;
  items: number;       // cantidad de líneas/productos de la factura
  productos: string;   // resumen legible de los productos ("A, B +2")
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
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
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
            <span class="p-2 rounded-lg bg-blue-50 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/></svg>
            </span>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-start justify-between">
            <div>
              <p class="text-sm text-slate-500">Clientes Nuevos</p>
              <p class="text-3xl font-bold text-slate-900 mt-2">{{ kpis().nuevos | number }}</p>
            </div>
            <span class="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
            </span>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-start justify-between">
            <div>
              <p class="text-sm text-slate-500">Clientes Inactivos</p>
              <p class="text-3xl font-bold text-slate-900 mt-2">{{ kpis().inactivos | number }}</p>
            </div>
            <span class="p-2 rounded-lg bg-amber-50 text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
            </span>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-start justify-between">
            <div>
              <p class="text-sm text-slate-500">Clientes Bloqueados</p>
              <p class="text-3xl font-bold text-slate-900 mt-2">{{ kpis().bloqueados | number }}</p>
            </div>
            <span class="p-2 rounded-lg bg-rose-50 text-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
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
            <option value="Inactivo">Inactivos</option>
            <option value="Bloqueado">Bloqueados</option>
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
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
                <span class="text-slate-500">Persona de contacto:</span>
                <span class="text-slate-700">{{ s.contacto || '—' }}</span>
              </div>
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"/></svg>
                <span class="text-slate-500">Teléfono:</span>
                <a *ngIf="s.telefono; else sinTel" [href]="'tel:' + s.telefono" class="text-sky-600 hover:underline">{{ s.telefono }}</a>
                <ng-template #sinTel><span class="text-slate-700">—</span></ng-template>
              </div>
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
                <a [href]="mapaUrl(s)" target="_blank" rel="noopener"
                   class="text-sky-600 hover:underline inline-flex items-center gap-1 group"
                   title="Ver dirección en Google Maps">
                  <span>{{ direccionCompleta(s) }}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0 text-slate-400 group-hover:text-sky-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
                </a>
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
                <p class="text-xs text-slate-500">Crédito Asignado</p>
                <p class="text-slate-800 mt-0.5 font-semibold">{{ s.credito > 0 ? formatoCLP(s.credito) : '—' }}</p>
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

          <!-- Gráfico de historial de ventas (últimos 12 meses al mes actual) -->
          <section>
            <h4 class="text-sm font-semibold text-slate-900 mb-3">Historial de Ventas · Últimos 12 meses</h4>
            <div *ngIf="historialGrafico().total === 0" class="text-sm text-slate-400">Sin ventas en los últimos 12 meses.</div>
            <div class="h-60" [class.hidden]="historialGrafico().total === 0"><canvas #histCanvas></canvas></div>
          </section>

          <!-- Últimas Facturas (lista) — ahora prioritario, sobre el Top 10 -->
          <section>
            <h4 class="text-sm font-semibold text-slate-900 mb-3">Últimas Facturas</h4>
            <div *ngIf="historial().length === 0" class="text-sm text-slate-400">Sin facturas registradas.</div>
            <div class="space-y-2">
              <button *ngFor="let v of historial()" type="button"
                      (click)="verFactura(v)"
                      [disabled]="!v.documento"
                      [title]="v.documento ? 'Ver factura ' + v.documento + ' en Ventas' : ''"
                      class="w-full text-left flex items-center justify-between bg-slate-50 rounded-lg p-3 transition hover:bg-slate-100 hover:border-brand-300 border border-transparent disabled:cursor-default disabled:hover:bg-slate-50">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-white text-slate-500 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-slate-900 truncate">
                      <span *ngIf="v.documento; else sinDoc">Factura {{ v.documento }}</span>
                      <ng-template #sinDoc>Venta sin documento</ng-template>
                    </p>
                    <p class="text-xs text-slate-500 truncate" [title]="v.productos">
                      {{ fechaCorta(v.fecha) }} · {{ v.items }} {{ v.items === 1 ? 'producto' : 'productos' }}<span *ngIf="v.vendedor"> · {{ v.vendedor }}</span>
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-sm font-bold text-slate-900">{{ formatoCLP(v.monto) }}</span>
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Completada</span>
                  <svg *ngIf="v.documento" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/></svg>
                </div>
              </button>
            </div>
          </section>

          <!-- Top 10 productos — venta bruta como foco a la derecha -->
          <section>
            <h4 class="text-sm font-semibold text-slate-900 mb-3">Top 10 Productos · Por Venta Bruta</h4>
            <div *ngIf="topProductos().length === 0" class="text-sm text-slate-400">Sin compras registradas.</div>
            <div class="space-y-2">
              <div *ngFor="let p of topProductos(); let i = index" class="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="w-6 h-6 inline-flex items-center justify-center rounded-full bg-sky-600 text-white text-xs font-bold shrink-0">{{ i + 1 }}</span>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-slate-900 truncate" [title]="p.nombre">{{ p.nombre }}</p>
                    <p class="text-xs text-slate-500">{{ p.cantidad | number }} unidades</p>
                  </div>
                </div>
                <span class="text-sm font-bold text-emerald-600 shrink-0 ml-3 whitespace-nowrap">{{ formatoCLP(p.monto) }}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class ClientesComponent implements OnDestroy {
  dataset = inject(DatasetService);
  clientesMaestro = inject(ClientesMaestroService);
  private router = inject(Router);
  Math = Math;
  pageSize = PAGE_SIZE;

  histCanvas = viewChild<ElementRef<HTMLCanvasElement>>('histCanvas');

  listoParaCalcular = signal(false);

  texto = signal('');
  estadoFiltro = signal<'' | Estado>('');
  vendedorFiltro = signal('');
  pagina = signal(0);
  seleccionado = signal<ResumenCliente | null>(null);

  // RUTs con ventas impagas/pendientes (cliente bloqueado). Vendrá del módulo
  // de cobranza; por ahora vacío hasta integrar esos datos.
  impagasApp = signal<Set<string>>(new Set());

  private historialChart?: Chart;

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);
    // Ficha maestra (contacto/teléfono/crédito) creada desde la app móvil.
    this.clientesMaestro.cargar();

    effect(() => {
      const canvas = this.histCanvas();
      const serie = this.historialGrafico();
      if (!canvas) return;
      queueMicrotask(() => this.renderHistorial(canvas, serie));
    });
  }

  ngOnDestroy(): void {
    this.historialChart?.destroy();
  }

  private normalizarRut(rut: string): string {
    return rut.trim().toUpperCase().replace(/\./g, '');
  }

  todosClientes = computed<ResumenCliente[]>(() => {
    const hoy = this.fechaReferencia();
    const impagas = this.impagasApp();
    const map = new Map<string, ResumenCliente & { _vendedores: Map<string, number>; _rutNorm: string }>();
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
          contacto: '',
          telefono: '',
          credito: 0,
          facturacion: 0,
          margen: 0,
          margenPct: 0,
          cantidadDocs: 0,
          ticketPromedio: 0,
          primerCompra: null,
          ultimaCompra: null,
          vendedorPrincipal: '',
          estado: 'Inactivo',
          _vendedores: new Map<string, number>(),
          _rutNorm: r.clienteRut ? this.normalizarRut(r.clienteRut) : '',
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

    // Ficha maestra desde la app (contacto/teléfono/crédito), cruzada por RUT.
    const maestro = this.clientesMaestro.mapaPorRut();
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
      const fichaMaestra = c._rutNorm ? maestro.get(c._rutNorm) : undefined;
      if (fichaMaestra) {
        c.contacto = fichaMaestra.contacto || '';
        c.telefono = fichaMaestra.telefono || '';
        c.credito = fichaMaestra.credito || 0;
        if (!c.direccion) c.direccion = fichaMaestra.direccion || '';
      }
      const bloqueado = !!c._rutNorm && impagas.has(c._rutNorm);
      c.estado = this.calcularEstado(c.primerCompra, c.ultimaCompra, hoy, bloqueado);
      delete (c as { _vendedores?: Map<string, number> })._vendedores;
      delete (c as { _rutNorm?: string })._rutNorm;
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
    let activos = 0, nuevos = 0, inactivos = 0, bloqueados = 0, facturacion = 0;
    for (const c of lista) {
      if (c.estado === 'Activo') activos++;
      else if (c.estado === 'Nuevo') nuevos++;
      else if (c.estado === 'Inactivo') inactivos++;
      else if (c.estado === 'Bloqueado') bloqueados++;
      facturacion += c.facturacion;
    }
    return { total: lista.length, activos, nuevos, inactivos, bloqueados, facturacion };
  });

  // Historial agrupado por FACTURA (documento), no por línea de producto.
  historial = computed<FacturaCliente[]>(() => {
    const c = this.seleccionado();
    if (!c) return [];
    const clienteId = (c.rut || c.nombre).toUpperCase();
    const map = new Map<string, {
      documento: string; vendedor: string; fecha: Date | null;
      monto: number; items: number; productos: string[];
    }>();
    for (const r of this.dataset.registros()) {
      const id = (r.clienteRut?.trim() || r.nombreCliente?.trim() || '').toUpperCase();
      if (id !== clienteId) continue;
      // Agrupa por documento+sucursal (misma clave que usa el conteo de ventas).
      const doc = (r.numeroDocumento || '').trim();
      const clave = doc ? doc + '|' + r.sucursal : 'SIN-DOC|' + this.parsearFecha(r)?.getTime();
      let f = map.get(clave);
      if (!f) {
        f = { documento: doc, vendedor: (r.vendedor || '').trim(), fecha: null, monto: 0, items: 0, productos: [] };
        map.set(clave, f);
      }
      f.monto += r.ventaTotalBruta;
      f.items += 1;
      const fecha = this.parsearFecha(r);
      if (fecha && (!f.fecha || fecha > f.fecha)) f.fecha = fecha;
      const p = (r.producto || '').trim();
      if (p && !f.productos.includes(p)) f.productos.push(p);
    }
    const facturas: FacturaCliente[] = Array.from(map.values()).map((f) => {
      const primeros = f.productos.slice(0, 2).join(', ');
      const extra = f.productos.length > 2 ? ` +${f.productos.length - 2}` : '';
      return {
        documento: f.documento,
        vendedor: f.vendedor,
        fecha: f.fecha,
        monto: f.monto,
        items: f.items,
        productos: primeros ? primeros + extra : 'Sin detalle',
      };
    });
    facturas.sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));
    return facturas.slice(0, 20);
  });

  // Serie mensual: 12 meses terminando en el mes de referencia (mes actual).
  historialGrafico = computed<{ labels: string[]; data: number[]; total: number }>(() => {
    const c = this.seleccionado();
    if (!c) return { labels: [], data: [], total: 0 };
    const ref = this.fechaReferencia();
    const meses: { y: number; m: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
      meses.push({ y: d.getFullYear(), m: d.getMonth() });
    }
    const data = Array(12).fill(0);
    const clienteId = (c.rut || c.nombre).toUpperCase();
    for (const r of this.dataset.registros()) {
      const id = (r.clienteRut?.trim() || r.nombreCliente?.trim() || '').toUpperCase();
      if (id !== clienteId) continue;
      const f = this.parsearFecha(r);
      if (!f) continue;
      const idx = meses.findIndex((x) => x.y === f.getFullYear() && x.m === f.getMonth());
      if (idx >= 0) data[idx] += r.ventaTotalBruta;
    }
    const labels = meses.map((x) => MESES_CORTO[x.m] + " '" + String(x.y).slice(2));
    const total = data.reduce((a, b) => a + b, 0);
    return { labels, data, total };
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
    return Array.from(map.values()).sort((a, b) => b.monto - a.monto).slice(0, 10);
  });

  abrir(c: ResumenCliente) { this.seleccionado.set(c); }
  cerrar() { this.seleccionado.set(null); }

  // Navega a la pestaña Ventas mostrando el detalle de esa factura (documento).
  verFactura(v: FacturaCliente): void {
    if (!v.documento) return;
    this.cerrar();
    this.router.navigate(['/ventas'], { queryParams: { doc: v.documento } });
  }

  badgeClases(e: Estado): string {
    if (e === 'Nuevo') return 'bg-emerald-100 text-emerald-700';
    if (e === 'Activo') return 'bg-blue-100 text-blue-700';
    if (e === 'Inactivo') return 'bg-amber-100 text-amber-700';
    if (e === 'Bloqueado') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-200 text-slate-600';
  }

  direccionResumen(c: ResumenCliente): string {
    const partes = [c.direccion, c.comuna, c.ciudad].filter((x) => x && x.length > 0);
    return partes.join(', ');
  }

  direccionCompleta(c: ResumenCliente): string {
    return this.direccionResumen(c) || '—';
  }

  // Enlace a Google Maps con la dirección del cliente (búsqueda por texto).
  mapaUrl(c: ResumenCliente): string {
    const q = this.direccionResumen(c);
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }

  formatoCLP(n: number): string {
    return '$' + (Math.round(n) || 0).toLocaleString('es-CL');
  }

  private compactCLP(n: number): string {
    if (!n) return '$0';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
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
    let maxTs = 0;
    for (const r of this.dataset.registros()) {
      const f = this.parsearFecha(r);
      if (f && f.getTime() > maxTs) maxTs = f.getTime();
    }
    return maxTs > 0 ? new Date(maxTs) : new Date(anio, 11, 31);
  }

  // Reglas:
  //  - Bloqueado: cliente con venta impaga/pendiente (flag, prioridad alta).
  //  - Nuevo: su primera compra ocurre en el mes en curso.
  //  - Activo: tiene ventas en los últimos 6 meses.
  //  - Inactivo: no tiene ventas en los últimos 6 meses.
  private calcularEstado(primera: Date | null, ultima: Date | null, hoy: Date, bloqueado: boolean): Estado {
    if (bloqueado) return 'Bloqueado';
    if (!ultima) return 'Inactivo';
    if (primera && primera.getFullYear() === hoy.getFullYear() && primera.getMonth() === hoy.getMonth()) {
      return 'Nuevo';
    }
    const limite6m = new Date(hoy.getFullYear(), hoy.getMonth() - 6, hoy.getDate());
    if (ultima >= limite6m) return 'Activo';
    return 'Inactivo';
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

  private renderHistorial(
    canvas: ElementRef<HTMLCanvasElement>,
    serie: { labels: string[]; data: number[]; total: number },
  ): void {
    this.historialChart?.destroy();
    if (serie.total === 0) return;

    const compact = (n: number) => this.compactCLP(n);
    const etiquetaValores = {
      id: 'etiquetaValores',
      afterDatasetsDraw(chart: Chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.fillStyle = '#065f46';
        ctx.font = '600 10px sans-serif';
        ctx.textAlign = 'center';
        meta.data.forEach((bar, idx) => {
          const val = serie.data[idx];
          if (!val) return;
          ctx.fillText(compact(val), bar.x, bar.y - 5);
        });
        ctx.restore();
      },
    };

    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: serie.labels,
        datasets: [
          {
            label: 'Ventas',
            data: serie.data,
            backgroundColor: '#10b981',
            hoverBackgroundColor: '#059669',
            borderRadius: 4,
            maxBarThickness: 34,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 18 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => '$' + (ctx.parsed.y || 0).toLocaleString('es-CL') },
          },
        },
        scales: {
          y: { display: false, beginAtZero: true, grace: '12%' },
          x: { ticks: { font: { size: 10 } }, grid: { display: false } },
        },
      },
      plugins: [etiquetaValores],
    };
    this.historialChart = new Chart(canvas.nativeElement, cfg);
  }
}
