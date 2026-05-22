import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { CategoriasService } from '../../services/categorias.service';
import { DatasetService } from '../../services/dataset.service';
import { MetasService } from '../../services/metas.service';
import { RegistroVenta } from '../../models/dataset';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { ProgressBarComponent } from '../../shared/progress-bar/progress-bar.component';
import { colorPorNombre, iniciales } from '../../utils/colores';

Chart.register(...registerables);

const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface VendedorListado {
  nombre: string;
  iniciales: string;
  color: string;
  ventasBrutas: number;
  meta: number;
  cumplimiento: number;
  rendimiento: Rendimiento;
}

type Rendimiento = 'Excelente' | 'Bueno' | 'Regular' | 'Bajo' | 'Sin meta';

interface MetricasVendedor {
  ventasBrutas: number;
  ventasNetas: number;
  margen: number;
  margenPct: number;
  meta: number;
  cumplimiento: number;
  ventasBrutasProy: number;
  cumplimientoProy: number;
  ventaDiariaNec: number;
  metaCumplida: boolean;
  vsMesAntPeriodo: number;
  deltaVsMesAnt: number;
  diferenciaMeta: number;
}

interface ProductoTop {
  nombre: string;
  marca: string;
  tipo: string;
  ventas: number; // # documentos
  unidades: number;
  precioPromedio: number;
  ventasMonto: number;
  margen: number;
  margenPct: number;
  pctMargenSobreMax: number;
  pctVentasSobreMax: number;
  pctUnidadesSobreMax: number;
}

@Component({
  selector: 'app-equipo',
  standalone: true,
  imports: [CommonModule, AvatarComponent, BadgeComponent, ProgressBarComponent, EmptyStateComponent],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Equipo de Ventas</h1>
        <p class="text-sm text-slate-500 mt-1">Selecciona un vendedor para ver su detalle</p>
      </div>

      <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
        <button (click)="mesAnterior()" [disabled]="!puedeAnterior()"
                class="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
          </svg>
        </button>
        <span class="px-3 text-sm font-semibold text-slate-900 min-w-[140px] text-center">{{ etiquetaMes() }}</span>
        <button (click)="mesSiguiente()" [disabled]="!puedeSiguiente()"
                class="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
          </svg>
        </button>
      </div>
    </div>

    <ng-container *ngIf="dataset.cargando() || !listoParaCalcular(); else listo">
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-12 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <span class="inline-block w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
        <span>Cargando equipo...</span>
      </div>
    </ng-container>

    <ng-template #listo>
      <ng-container *ngIf="vendedores().length === 0; else ok">
        <app-empty-state
          titulo="Sin datos de equipo"
          descripcion="Carga un CSV con ventas para ver el rendimiento del equipo."
          enlace="/datos"
          enlaceLabel="Ir a Datos"
        ></app-empty-state>
      </ng-container>

      <ng-template #ok>
        <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          <aside class="space-y-2">
            <button
              *ngFor="let v of vendedores()"
              type="button"
              (click)="seleccionar(v.nombre)"
              class="w-full text-left bg-white rounded-xl border p-3 transition hover:border-brand-400"
              [class.border-brand-500]="seleccionado() === v.nombre"
              [class.ring-2]="seleccionado() === v.nombre"
              [class.ring-brand-100]="seleccionado() === v.nombre"
              [class.border-slate-100]="seleccionado() !== v.nombre"
            >
              <div class="flex items-center gap-3">
                <app-avatar [iniciales]="v.iniciales" [color]="v.color" size="md"></app-avatar>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-slate-900 truncate">{{ v.nombre }}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs font-semibold w-10" [class]="colorTextoPct(v.cumplimiento)">
                      {{ v.meta > 0 ? (v.cumplimiento | number:'1.0-0') + '%' : '—' }}
                    </span>
                    <div class="flex-1">
                      <app-progress-bar [valor]="v.cumplimiento" [alto]="4"></app-progress-bar>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </aside>

          <section *ngIf="vendedorSeleccionado() as v" class="space-y-4">
            <div class="bg-blue-50/40 rounded-xl border border-blue-100 p-5">
              <div class="flex items-start justify-between gap-3 mb-5">
                <div class="flex items-center gap-3 min-w-0">
                  <app-avatar [iniciales]="v.iniciales" [color]="v.color" size="xl"></app-avatar>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h2 class="text-lg font-bold text-slate-900 truncate">{{ v.nombre }}</h2>
                      <app-badge [tono]="tonoRendimiento(v.rendimiento)">{{ v.rendimiento }}</app-badge>
                    </div>
                    <p class="text-xs text-slate-500 mt-0.5">{{ etiquetaMes() }} · {{ dataset.anioActivo() }}</p>
                  </div>
                </div>
                <button (click)="cerrar()" class="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-white">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <ng-container *ngIf="metricas() as m">
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div class="bg-sky-50 rounded-lg border border-sky-100 p-4">
                    <p class="text-xs text-slate-500">Ventas Brutas</p>
                    <p class="text-xl font-bold text-slate-900 mt-1">{{ formatoCLP(m.ventasBrutas) }}</p>
                  </div>
                  <div class="bg-emerald-50 rounded-lg border border-emerald-100 p-4">
                    <p class="text-xs text-slate-500">Meta Mensual</p>
                    <p class="text-xl font-bold text-slate-900 mt-1">{{ m.meta > 0 ? formatoCLP(m.meta) : '—' }}</p>
                  </div>
                  <div class="bg-violet-50 rounded-lg border border-violet-100 p-4">
                    <p class="text-xs text-slate-500">Cumplimiento</p>
                    <p class="text-xl font-bold mt-1" [class]="colorTextoPct(m.cumplimiento)">
                      {{ m.meta > 0 ? (m.cumplimiento | number:'1.0-0') + '%' : '—' }}
                    </p>
                    <div class="mt-2" *ngIf="m.meta > 0">
                      <app-progress-bar [valor]="m.cumplimiento" [alto]="4" color="#1e293b"></app-progress-bar>
                    </div>
                  </div>
                  <div class="bg-amber-50 rounded-lg border border-amber-100 p-4">
                    <p class="text-xs text-slate-500">Margen %</p>
                    <p class="text-xl font-bold text-amber-600 mt-1">{{ m.margenPct | number:'1.1-1' }}%</p>
                  </div>
                </div>
              </ng-container>
            </div>

            <div class="bg-white rounded-xl border border-slate-100 p-5">
              <h3 class="text-base font-semibold text-slate-900 mb-4">Métricas de Desempeño</h3>
              <ng-container *ngIf="metricas() as m">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div class="border border-slate-100 rounded-lg px-3 py-3 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 text-slate-600 text-sm">
                      <span class="w-7 h-7 inline-flex items-center justify-center rounded-md bg-emerald-50 text-emerald-600 font-bold">$</span>
                      Ventas Brutas
                    </div>
                    <span class="text-sm font-bold text-slate-900">{{ formatoCLP(m.ventasBrutas) }}</span>
                  </div>
                  <div class="border border-slate-100 rounded-lg px-3 py-3 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 text-slate-600 text-sm">
                      <span class="w-7 h-7 inline-flex items-center justify-center rounded-md bg-emerald-50 text-emerald-600 font-bold">$</span>
                      Ventas Netas
                    </div>
                    <span class="text-sm font-bold text-emerald-600">{{ formatoCLP(m.ventasNetas) }}</span>
                  </div>
                  <div class="border border-slate-100 rounded-lg px-3 py-3 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 text-slate-600 text-sm">
                      <span class="w-7 h-7 inline-flex items-center justify-center rounded-md bg-violet-50 text-violet-600 font-bold">%</span>
                      Margen de Venta
                    </div>
                    <span class="text-sm font-bold text-violet-600 text-right">
                      {{ formatoCLP(m.margen) }}
                      <span class="block text-xs font-medium text-slate-500">({{ m.margenPct | number:'1.1-1' }}%)</span>
                    </span>
                  </div>

                  <div class="border border-slate-100 rounded-lg px-3 py-3 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 text-slate-600 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/>
                      </svg>
                      Ventas Brutas Proyectadas
                    </div>
                    <span class="text-sm font-bold text-sky-600">{{ formatoCLP(m.ventasBrutasProy) }}</span>
                  </div>
                  <div class="border border-slate-100 rounded-lg px-3 py-3 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 text-slate-600 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.59 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59"/>
                      </svg>
                      Cumplimiento Proyectado
                    </div>
                    <span class="text-sm font-bold" [class]="colorTextoPct(m.cumplimientoProy)">
                      {{ m.meta > 0 ? (m.cumplimientoProy | number:'1.0-0') + '%' : '—' }}
                    </span>
                  </div>
                  <div class="border border-slate-100 rounded-lg px-3 py-3 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 text-slate-600 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
                      </svg>
                      Venta Diaria Necesaria
                    </div>
                    <span class="text-sm font-bold text-right">
                      <ng-container *ngIf="m.metaCumplida; else necesaria">
                        <span class="text-sky-600">Meta cumplida</span>
                      </ng-container>
                      <ng-template #necesaria>
                        <span [class]="m.ventaDiariaNec > 0 ? 'text-slate-900' : 'text-slate-400'">
                          {{ m.ventaDiariaNec > 0 ? formatoCLP(m.ventaDiariaNec) : '—' }}
                        </span>
                      </ng-template>
                    </span>
                  </div>

                  <div class="border border-slate-100 rounded-lg px-3 py-3">
                    <p class="text-xs text-slate-500">Vs. Mes Anterior (mismo período)</p>
                    <div class="flex items-center justify-between mt-1 gap-3">
                      <span class="text-sm font-bold text-slate-900">{{ formatoCLP(m.vsMesAntPeriodo) }}</span>
                      <span class="inline-flex items-center gap-1 text-xs font-semibold"
                            [class.text-emerald-600]="m.deltaVsMesAnt >= 0"
                            [class.text-rose-600]="m.deltaVsMesAnt < 0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                          <path *ngIf="m.deltaVsMesAnt >= 0" stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/>
                          <path *ngIf="m.deltaVsMesAnt < 0" stroke-linecap="round" stroke-linejoin="round" d="M2.25 6 9 12.75l4.306-4.307a11.95 11.95 0 0 0 5.814 5.518l2.74 1.22m0 0-5.94 2.281m5.94-2.28-2.28-5.941"/>
                        </svg>
                        {{ m.deltaVsMesAnt >= 0 ? '+' : '' }}{{ m.deltaVsMesAnt | number:'1.1-1' }}%
                      </span>
                    </div>
                  </div>
                  <div class="border border-slate-100 rounded-lg px-3 py-3 flex items-center justify-between gap-3">
                    <span class="text-sm text-slate-600">Diferencia vs Meta</span>
                    <span class="text-sm font-bold" [class.text-emerald-600]="m.diferenciaMeta >= 0" [class.text-rose-600]="m.diferenciaMeta < 0">
                      {{ m.meta > 0 ? (m.diferenciaMeta >= 0 ? '+' : '') + formatoCLP(m.diferenciaMeta) : '—' }}
                    </span>
                  </div>
                </div>
              </ng-container>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="bg-white rounded-xl border border-slate-100 p-5">
                <h3 class="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>
                  </svg>
                  Cartera de Clientes
                </h3>
                <ng-container *ngIf="cartera() as c">
                  <div class="bg-sky-50/60 border border-sky-100 rounded-lg p-4 mb-3 flex items-center justify-between">
                    <div>
                      <p class="text-xs text-slate-500">Total de Clientes</p>
                      <p class="text-2xl font-bold text-slate-900 mt-1">{{ c.total }}</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-sky-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>
                    </svg>
                  </div>
                  <div class="bg-emerald-50/60 border border-emerald-100 rounded-lg p-4 mb-3 flex items-center justify-between">
                    <div>
                      <p class="text-xs text-slate-500">Clientes Visitados</p>
                      <p class="text-2xl font-bold text-slate-900 mt-1">{{ c.visitados }}</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                    </svg>
                  </div>
                  <div class="border border-slate-100 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                      <p class="text-sm text-slate-600">Tasa de Visita</p>
                      <p class="text-sm font-bold text-slate-900">{{ c.tasaVisita | number:'1.0-0' }}%</p>
                    </div>
                    <app-progress-bar [valor]="c.tasaVisita" [alto]="6" color="#0f172a"></app-progress-bar>
                  </div>
                </ng-container>
              </div>

              <div class="bg-white rounded-xl border border-slate-100 p-5">
                <h3 class="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/>
                  </svg>
                  Clientes Nuevos del Mes
                </h3>
                <ng-container *ngIf="clientesNuevos() as cn">
                  <div class="rounded-lg p-6 mb-4 text-center bg-gradient-to-br from-emerald-50 to-emerald-100/40 border border-emerald-100">
                    <p class="text-4xl font-bold text-emerald-600">{{ cn.length }}</p>
                    <p class="text-xs text-slate-600 mt-1">Clientes nuevos en {{ MESES_LARGO[mesSeleccionado() - 1] }}</p>
                  </div>
                  <ng-container *ngIf="cn.length > 0">
                    <p class="text-xs text-slate-500 mb-2">Detalle:</p>
                    <div class="space-y-1.5">
                      <div *ngFor="let n of cn.slice(0, 8)" class="flex items-center gap-2 border border-slate-100 rounded-md px-3 py-2">
                        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span class="text-sm text-slate-700 truncate">{{ n }}</span>
                      </div>
                      <p *ngIf="cn.length > 8" class="text-xs text-slate-400 italic mt-1">y {{ cn.length - 8 }} más...</p>
                    </div>
                  </ng-container>
                </ng-container>
              </div>
            </div>

            <div class="bg-white rounded-xl border border-slate-100 p-5">
              <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h3 class="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 9V4.5M9 9h4.5M15 9c0 .621-.504 1.125-1.125 1.125H9.375A1.125 1.125 0 0 1 8.25 9V4.5M9 9V4.5"/>
                  </svg>
                  Top 10 Productos - Análisis de Margen
                </h3>
                <span *ngIf="topProductos().length > 0" class="text-xs text-slate-500">
                  Ordenados por margen $ del mes
                </span>
              </div>

              <ng-container *ngIf="topProductos() as productos">
                <div *ngIf="productos.length === 0" class="text-sm text-slate-400 italic">Sin ventas en el mes.</div>
                <div class="space-y-2">
                  <div *ngFor="let p of productos; let i = index" class="border border-slate-100 rounded-lg p-3 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-start">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="w-6 h-6 inline-flex items-center justify-center rounded-full text-white text-xs font-bold shrink-0"
                              [class.bg-amber-400]="i === 0"
                              [class.bg-slate-400]="i === 1"
                              [class.bg-orange-400]="i === 2"
                              [class.bg-sky-600]="i > 2">{{ i + 1 }}</span>
                        <span class="text-sm font-semibold text-slate-900 truncate" [title]="p.nombre">{{ p.nombre }}</span>
                      </div>
                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pl-8">
                        <span *ngIf="p.marca"><span class="text-slate-400">Marca:</span> <span class="text-slate-700 font-medium">{{ p.marca }}</span></span>
                        <span *ngIf="p.tipo"><span class="text-slate-400">Tipo:</span> <span class="text-slate-700 font-medium">{{ p.tipo }}</span></span>
                        <span><span class="text-slate-400">Precio prom.:</span> <span class="text-slate-700 font-medium">{{ formatoCLP(p.precioPromedio) }}</span></span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 lg:justify-end">
                      <span class="inline-flex items-center justify-center min-w-[64px] h-7 px-2 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold">{{ p.ventas }} ventas</span>
                      <span class="inline-flex items-center justify-center min-w-[80px] h-7 px-2 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">{{ p.unidades | number }} und</span>
                    </div>
                    <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 pl-8">
                      <div>
                        <p class="text-xs text-slate-500">Ventas: <span class="font-bold text-slate-900">{{ formatoCLP(p.ventasMonto) }}</span></p>
                        <div class="mt-1.5"><app-progress-bar [valor]="p.pctVentasSobreMax" [alto]="4" color="#0ea5e9"></app-progress-bar></div>
                      </div>
                      <div>
                        <p class="text-xs text-slate-500">Margen: <span class="font-bold text-emerald-600">{{ formatoCLP(p.margen) }}</span> <span class="text-slate-500">({{ p.margenPct | number:'1.1-1' }}%)</span></p>
                        <div class="mt-1.5"><app-progress-bar [valor]="p.pctMargenSobreMax" [alto]="4" color="#10b981"></app-progress-bar></div>
                      </div>
                      <div>
                        <p class="text-xs text-slate-500">Unidades: <span class="font-bold text-slate-900">{{ p.unidades | number }}</span></p>
                        <div class="mt-1.5"><app-progress-bar [valor]="p.pctUnidadesSobreMax" [alto]="4" color="#8b5cf6"></app-progress-bar></div>
                      </div>
                    </div>
                  </div>
                </div>
              </ng-container>
            </div>

            <div class="bg-white rounded-xl border border-slate-100 p-5">
              <h3 class="text-base font-semibold text-slate-900 mb-4">Historial de Ventas - Año {{ dataset.anioActivo() }}</h3>
              <div class="h-72"><canvas #histCanvas></canvas></div>
              <div class="grid grid-cols-3 gap-3 mt-5" *ngIf="ultimosTresMeses() as u3">
                <div *ngFor="let m of u3" class="bg-slate-50 border border-slate-100 rounded-lg p-4 text-center">
                  <p class="text-xs text-slate-500">{{ m.label }}</p>
                  <p class="text-lg font-bold text-sky-600 mt-1">{{ formatoCLP(m.valor) }}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </ng-template>
    </ng-template>
  `,
})
export class EquipoComponent implements OnInit, OnDestroy {
  histCanvas = viewChild<ElementRef<HTMLCanvasElement>>('histCanvas');

  dataset = inject(DatasetService);
  metasService = inject(MetasService);
  categoriasService = inject(CategoriasService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  listoParaCalcular = signal(false);
  mesSeleccionado = signal<number>(new Date().getMonth() + 1);
  seleccionado = signal<string | null>(null);

  MESES_LARGO = MESES_LARGO;

  private historialChart?: Chart;

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);

    effect(() => {
      const anio = this.dataset.anioActivo();
      if (anio != null && this.metasService.anioCargado() !== anio) {
        this.metasService.cargarAnio(anio);
      }
    });

    effect(() => {
      const canvas = this.histCanvas();
      const data = this.historialMensual();
      if (!canvas) return;
      queueMicrotask(() => this.renderHistorial(canvas, data));
    });
  }

  async ngOnInit() {
    if (this.categoriasService.totalCargados() === 0) {
      await this.categoriasService.cargar();
    }
    const anio = this.dataset.anioActivo();
    if (anio != null && this.metasService.anioCargado() !== anio) {
      await this.metasService.cargarAnio(anio);
    }

    this.route.queryParamMap.subscribe((qp) => {
      const mes = Number(qp.get('mes'));
      if (Number.isInteger(mes) && mes >= 1 && mes <= 12) {
        this.mesSeleccionado.set(mes);
      }
      const vendedor = qp.get('vendedor');
      if (vendedor) {
        this.seleccionado.set(vendedor);
      } else if (this.seleccionado() === null) {
        const primero = this.vendedores()[0];
        if (primero) this.seleccionado.set(primero.nombre);
      }
    });
  }

  ngOnDestroy(): void {
    this.historialChart?.destroy();
  }

  etiquetaMes(): string {
    return MESES_LARGO[this.mesSeleccionado() - 1];
  }

  puedeAnterior(): boolean { return this.mesSeleccionado() > 1; }
  puedeSiguiente(): boolean { return this.mesSeleccionado() < 12; }
  mesAnterior(): void { if (this.puedeAnterior()) this.mesSeleccionado.update((v) => v - 1); }
  mesSiguiente(): void { if (this.puedeSiguiente()) this.mesSeleccionado.update((v) => v + 1); }

  seleccionar(nombre: string): void {
    this.seleccionado.set(nombre);
  }

  cerrar(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    this.seleccionado.set(null);
  }

  formatoCLP(n: number): string {
    return '$' + (Math.round(n) || 0).toLocaleString('es-CL');
  }

  colorTextoPct(pct: number): string {
    if (pct >= 100) return 'text-emerald-600';
    if (pct >= 80) return 'text-sky-600';
    if (pct >= 50) return 'text-amber-600';
    return 'text-rose-600';
  }

  tonoRendimiento(r: Rendimiento): 'verde' | 'azul' | 'amarillo' | 'rojo' | 'gris' {
    if (r === 'Excelente') return 'verde';
    if (r === 'Bueno') return 'azul';
    if (r === 'Regular') return 'amarillo';
    if (r === 'Bajo') return 'rojo';
    return 'gris';
  }

  private registrosMes = computed(() => {
    const mes = this.mesSeleccionado();
    return this.dataset.registros().filter((r) => r.mes === mes);
  });

  private factorProyeccion = computed(() => {
    const anio = this.dataset.anioActivo();
    const mes = this.mesSeleccionado();
    const hoy = new Date();
    if (anio == null) return 1;
    if (anio < hoy.getFullYear() || (anio === hoy.getFullYear() && mes < hoy.getMonth() + 1)) return 1;
    if (anio > hoy.getFullYear() || (anio === hoy.getFullYear() && mes > hoy.getMonth() + 1)) return 0;
    const diasMes = new Date(anio, mes, 0).getDate();
    return diasMes / Math.max(1, hoy.getDate());
  });

  private diasMes = computed(() => {
    const anio = this.dataset.anioActivo() ?? new Date().getFullYear();
    const mes = this.mesSeleccionado();
    return new Date(anio, mes, 0).getDate();
  });

  private diaCorte = computed(() => {
    const anio = this.dataset.anioActivo();
    const mes = this.mesSeleccionado();
    const hoy = new Date();
    if (anio === hoy.getFullYear() && mes === hoy.getMonth() + 1) return hoy.getDate();
    if (anio != null && (anio < hoy.getFullYear() || (anio === hoy.getFullYear() && mes < hoy.getMonth() + 1))) {
      return this.diasMes();
    }
    return 0; // mes futuro
  });

  vendedores = computed<VendedorListado[]>(() => {
    const rows = this.registrosMes();
    const metas = this.metasService.metas();
    const mes = this.mesSeleccionado();
    const anio = this.dataset.anioActivo();

    const acum = new Map<string, { ventasBrutas: number; meta: number }>();
    const display = new Map<string, string>();
    const norm = (s: string) => s.trim().toUpperCase();

    const obtener = (n: string) => {
      const k = norm(n);
      if (!display.has(k)) display.set(k, n.trim());
      let prev = acum.get(k);
      if (!prev) {
        prev = { ventasBrutas: 0, meta: 0 };
        acum.set(k, prev);
      }
      return prev;
    };

    for (const r of rows) {
      if (!r.vendedor) continue;
      obtener(r.vendedor).ventasBrutas += r.ventaTotalBruta;
    }
    for (const m of metas) {
      if (m.anio !== anio || m.mes !== mes || !m.vendedor) continue;
      obtener(m.vendedor).meta += m.metaClp;
    }

    const lista: VendedorListado[] = [];
    for (const [k, a] of acum) {
      const nombre = display.get(k) ?? k;
      const cumplimiento = a.meta > 0 ? (a.ventasBrutas / a.meta) * 100 : 0;
      lista.push({
        nombre,
        iniciales: iniciales(nombre),
        color: colorPorNombre(nombre),
        ventasBrutas: a.ventasBrutas,
        meta: a.meta,
        cumplimiento,
        rendimiento: this.calcRendimiento(a.meta, cumplimiento),
      });
    }
    lista.sort((x, y) => y.cumplimiento - x.cumplimiento || y.ventasBrutas - x.ventasBrutas);
    return lista;
  });

  vendedorSeleccionado = computed<VendedorListado | null>(() => {
    const n = this.seleccionado();
    if (!n) return null;
    const norm = (s: string) => s.trim().toUpperCase();
    return this.vendedores().find((v) => norm(v.nombre) === norm(n)) ?? null;
  });

  private registrosVendedor = computed(() => {
    const v = this.vendedorSeleccionado();
    if (!v) return { mes: [] as RegistroVenta[], anio: [] as RegistroVenta[] };
    const norm = (s: string) => s.trim().toUpperCase();
    const target = norm(v.nombre);
    const mes = this.mesSeleccionado();
    const anio: RegistroVenta[] = [];
    const enMes: RegistroVenta[] = [];
    for (const r of this.dataset.registros()) {
      if (norm(r.vendedor ?? '') !== target) continue;
      anio.push(r);
      if (r.mes === mes) enMes.push(r);
    }
    return { mes: enMes, anio };
  });

  metricas = computed<MetricasVendedor | null>(() => {
    const v = this.vendedorSeleccionado();
    if (!v) return null;
    const { mes } = this.registrosVendedor();

    let ventasBrutas = 0, ventasNetas = 0, margen = 0;
    for (const r of mes) {
      ventasBrutas += r.ventaTotalBruta;
      ventasNetas += r.ventaTotalNeta;
      margen += r.margen;
    }
    const margenPct = ventasBrutas > 0 ? (margen / ventasBrutas) * 100 : 0;
    const meta = v.meta;
    const cumplimiento = meta > 0 ? (ventasBrutas / meta) * 100 : 0;
    const factor = this.factorProyeccion();
    const ventasBrutasProy = ventasBrutas * factor;
    const cumplimientoProy = meta > 0 ? (ventasBrutasProy / meta) * 100 : 0;
    const diferenciaMeta = meta > 0 ? ventasBrutas - meta : 0;

    const diaCorte = this.diaCorte();
    const dias = this.diasMes();
    const diasRestantes = Math.max(0, dias - diaCorte);
    const metaCumplida = meta > 0 && ventasBrutas >= meta;
    const ventaDiariaNec = !metaCumplida && meta > 0 && diasRestantes > 0
      ? (meta - ventasBrutas) / diasRestantes
      : 0;

    // Vs mes anterior (mismo período)
    const mesAnt = this.mesSeleccionado() - 1;
    const anioAct = this.dataset.anioActivo();
    let vsMesAntPeriodo = 0;
    if (mesAnt >= 1 && anioAct != null) {
      const diasMesAnt = new Date(anioAct, mesAnt, 0).getDate();
      const corte = Math.min(diaCorte || diasMesAnt, diasMesAnt);
      const norm = (s: string) => s.trim().toUpperCase();
      const target = norm(v.nombre);
      for (const r of this.dataset.registros()) {
        if (norm(r.vendedor ?? '') !== target) continue;
        if (r.mes === mesAnt && r.dia <= corte) vsMesAntPeriodo += r.ventaTotalBruta;
      }
    }
    const deltaVsMesAnt = vsMesAntPeriodo > 0 ? ((ventasBrutas - vsMesAntPeriodo) / vsMesAntPeriodo) * 100 : 0;

    return {
      ventasBrutas, ventasNetas, margen, margenPct, meta, cumplimiento,
      ventasBrutasProy, cumplimientoProy, ventaDiariaNec, metaCumplida,
      vsMesAntPeriodo, deltaVsMesAnt, diferenciaMeta,
    };
  });

  cartera = computed<{ total: number; visitados: number; tasaVisita: number } | null>(() => {
    if (!this.vendedorSeleccionado()) return null;
    const { mes, anio } = this.registrosVendedor();
    const total = new Set<string>();
    const visitados = new Set<string>();
    for (const r of anio) if (r.clienteRut) total.add(r.clienteRut.trim());
    for (const r of mes) if (r.clienteRut) visitados.add(r.clienteRut.trim());
    const tasaVisita = total.size > 0 ? (visitados.size / total.size) * 100 : 0;
    return { total: total.size, visitados: visitados.size, tasaVisita };
  });

  clientesNuevos = computed<string[]>(() => {
    if (!this.vendedorSeleccionado()) return [];
    const { mes, anio } = this.registrosVendedor();
    const mesSel = this.mesSeleccionado();
    const previos = new Set<string>();
    for (const r of anio) {
      if (r.mes < mesSel && r.clienteRut) previos.add(r.clienteRut.trim());
    }
    const nuevos = new Map<string, string>();
    for (const r of mes) {
      const rut = r.clienteRut?.trim();
      if (!rut || previos.has(rut)) continue;
      if (!nuevos.has(rut)) nuevos.set(rut, r.nombreCliente?.trim() || rut);
    }
    return Array.from(nuevos.values());
  });

  topProductos = computed<ProductoTop[]>(() => {
    if (!this.vendedorSeleccionado()) return [];
    const { mes } = this.registrosVendedor();
    type Acum = {
      ventasMonto: number;
      margen: number;
      unidades: number;
      docs: Set<string>;
      marcas: Map<string, number>;
      tipos: Map<string, number>;
    };
    const map = new Map<string, Acum>();
    for (const r of mes) {
      const nombre = (r.producto || '').trim();
      if (!nombre) continue;
      let prev = map.get(nombre);
      if (!prev) {
        prev = { ventasMonto: 0, margen: 0, unidades: 0, docs: new Set(), marcas: new Map(), tipos: new Map() };
        map.set(nombre, prev);
      }
      prev.ventasMonto += r.ventaTotalBruta;
      prev.margen += r.margen;
      prev.unidades += r.cantidad || 0;
      if (r.numeroDocumento) prev.docs.add(r.numeroDocumento);
      const marca = (r.marca || '').trim();
      if (marca) prev.marcas.set(marca, (prev.marcas.get(marca) ?? 0) + 1);
      const tipo = (r.tipoProducto || '').trim();
      if (tipo) prev.tipos.set(tipo, (prev.tipos.get(tipo) ?? 0) + 1);
    }
    const dominante = (m: Map<string, number>): string => {
      let best = ''; let max = 0;
      m.forEach((v, k) => { if (v > max) { max = v; best = k; } });
      return best;
    };
    const arr: ProductoTop[] = Array.from(map.entries()).map(([nombre, x]) => ({
      nombre,
      marca: dominante(x.marcas),
      tipo: dominante(x.tipos),
      ventas: x.docs.size,
      unidades: x.unidades,
      precioPromedio: x.unidades > 0 ? x.ventasMonto / x.unidades : 0,
      ventasMonto: x.ventasMonto,
      margen: x.margen,
      margenPct: x.ventasMonto > 0 ? (x.margen / x.ventasMonto) * 100 : 0,
      pctMargenSobreMax: 0,
      pctVentasSobreMax: 0,
      pctUnidadesSobreMax: 0,
    }));
    arr.sort((a, b) => b.margen - a.margen);
    const top = arr.slice(0, 10);
    const maxV = Math.max(0, ...top.map((p) => p.ventasMonto));
    const maxM = Math.max(0, ...top.map((p) => p.margen));
    const maxU = Math.max(0, ...top.map((p) => p.unidades));
    top.forEach((p) => {
      p.pctVentasSobreMax = maxV > 0 ? (p.ventasMonto / maxV) * 100 : 0;
      p.pctMargenSobreMax = maxM > 0 ? (p.margen / maxM) * 100 : 0;
      p.pctUnidadesSobreMax = maxU > 0 ? (p.unidades / maxU) * 100 : 0;
    });
    return top;
  });

  historialMensual = computed<{ labels: string[]; data: number[]; anio: number | null }>(() => {
    const anio = this.dataset.anioActivo();
    const v = this.vendedorSeleccionado();
    const labels = MESES_CORTO.map((m) => m + (anio ? ' ' + anio : ''));
    const data = Array(12).fill(0);
    if (!v) return { labels, data, anio };
    const norm = (s: string) => s.trim().toUpperCase();
    const target = norm(v.nombre);
    for (const r of this.dataset.registros()) {
      if (norm(r.vendedor ?? '') !== target) continue;
      if (r.mes >= 1 && r.mes <= 12) data[r.mes - 1] += r.ventaTotalBruta;
    }
    return { labels, data, anio };
  });

  ultimosTresMeses = computed<{ label: string; valor: number }[]>(() => {
    const mes = this.mesSeleccionado();
    const anio = this.dataset.anioActivo();
    const { data } = this.historialMensual();
    const out: { label: string; valor: number }[] = [];
    for (let offset = 2; offset >= 0; offset--) {
      let m = mes - offset;
      let a = anio ?? new Date().getFullYear();
      while (m <= 0) { m += 12; a -= 1; }
      const valor = a === anio ? (data[m - 1] ?? 0) : 0;
      out.push({ label: MESES_LARGO[m - 1] + ' ' + a, valor });
    }
    return out;
  });

  private calcRendimiento(meta: number, cumplimiento: number): Rendimiento {
    if (meta <= 0) return 'Sin meta';
    if (cumplimiento >= 100) return 'Excelente';
    if (cumplimiento >= 80) return 'Bueno';
    if (cumplimiento >= 50) return 'Regular';
    return 'Bajo';
  }

  private renderHistorial(
    canvas: ElementRef<HTMLCanvasElement>,
    serie: { labels: string[]; data: number[] },
  ): void {
    this.historialChart?.destroy();
    const cfg: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: serie.labels,
        datasets: [
          {
            label: 'Ventas',
            data: serie.data,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#2563eb',
            pointBorderWidth: 2,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => '$' + (ctx.parsed.y || 0).toLocaleString('es-CL'),
            },
          },
        },
        scales: {
          y: {
            ticks: { font: { size: 10 }, callback: (v) => Number(v).toLocaleString('es-CL') },
            grid: { color: '#f1f5f9' },
          },
          x: { ticks: { font: { size: 10 } }, grid: { display: false } },
        },
      },
    };
    this.historialChart = new Chart(canvas.nativeElement, cfg);
  }
}
