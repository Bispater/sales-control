import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { GruposDiasService } from '../../services/grupos-dias.service';
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

interface CobranzaItem {
  cliente: string;
  dias: number;       // total de días de atraso
  porcentaje: number; // % (definición pendiente de los datos de cobranza)
  moraClp: number;    // monto en mora en CLP
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
  descuentoPct: number;
  clientesUnicos: number;
  pctMargenSobreMax: number;
  pctVentasSobreMax: number;
  pctUnidadesSobreMax: number;
  pctCoberturaSobreMax: number;
}

@Component({
  selector: 'app-equipo',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent, BadgeComponent, ProgressBarComponent, EmptyStateComponent],
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
                  <div class="grid grid-cols-2 gap-3">
                    <!-- Total de Clientes -->
                    <div class="bg-sky-50/60 border border-sky-100 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p class="text-xs text-slate-500">Total de Clientes</p>
                        <p class="text-2xl font-bold text-slate-900 mt-1">{{ c.total }}</p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>
                      </svg>
                    </div>
                    <!-- Clientes Visitados (con tasa de visita bajo el ícono) -->
                    <div class="bg-emerald-50/60 border border-emerald-100 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p class="text-xs text-slate-500">Clientes Visitados</p>
                        <p class="text-2xl font-bold text-slate-900 mt-1">{{ c.visitados ?? '—' }}</p>
                      </div>
                      <div class="flex flex-col items-center gap-1 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                        </svg>
                        <span class="text-[10px] font-semibold text-emerald-700 leading-none">
                          {{ c.tasaVisita != null ? (c.tasaVisita | number:'1.0-0') + '%' : '—' }}
                        </span>
                      </div>
                    </div>
                    <!-- Clientes sin Visitar -->
                    <div class="bg-amber-50/60 border border-amber-100 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p class="text-xs text-slate-500">Clientes sin Visitar</p>
                        <p class="text-2xl font-bold text-slate-900 mt-1">{{ c.sinVisitar }}</p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/>
                      </svg>
                    </div>
                    <!-- Clientes con Ventas -->
                    <div class="bg-violet-50/60 border border-violet-100 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p class="text-xs text-slate-500">Clientes con Ventas</p>
                        <p class="text-2xl font-bold text-slate-900 mt-1">{{ c.conVentas }}</p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/>
                      </svg>
                    </div>
                  </div>

                  <!-- Lista scroll de clientes no visitados (métrica de la app del vendedor) -->
                  <div class="mt-4">
                    <p class="text-xs text-slate-500 mb-2">Clientes sin visitar</p>
                    <div class="border border-slate-100 rounded-lg max-h-56 overflow-y-auto">
                      <ng-container *ngIf="c.noVisitados.length > 0; else sinMetricaVisitas">
                        <div *ngFor="let n of c.noVisitados" class="flex items-center gap-2 px-3 py-2 border-b border-slate-50 last:border-b-0">
                          <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                          <span class="text-sm text-slate-700 truncate">{{ n }}</span>
                        </div>
                      </ng-container>
                      <ng-template #sinMetricaVisitas>
                        <div class="px-3 py-8 text-center">
                          <p class="text-sm text-slate-500">Pendiente de la app</p>
                          <p class="text-xs text-slate-400 mt-1">La lista de clientes no visitados se activará cuando el vendedor registre las visitas desde la aplicación.</p>
                        </div>
                      </ng-template>
                    </div>
                  </div>
                </ng-container>
              </div>

              <div class="bg-white rounded-xl border border-slate-100 p-5 flex flex-col">
                <h3 class="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/>
                  </svg>
                  Clientes Nuevos del Mes
                </h3>
                <ng-container *ngIf="clientesNuevos() as cn">
                  <div class="rounded-lg p-5 mb-4 text-center bg-gradient-to-br from-emerald-50 to-emerald-100/40 border border-emerald-100 shrink-0">
                    <p class="text-4xl font-bold text-emerald-600">{{ cn.length }}</p>
                    <p class="text-xs text-slate-600 mt-1">Clientes nuevos en {{ MESES_LARGO[mesSeleccionado() - 1] }}</p>
                  </div>
                  <ng-container *ngIf="cn.length > 0; else sinNuevos">
                    <p class="text-xs text-slate-500 mb-2 shrink-0">Detalle:</p>
                    <!-- flex-1 + min-h-0 en lg: la altura la fija la card izquierda; la lista absoluta no empuja la fila y scrollea por dentro -->
                    <div class="relative flex-1 min-h-[18rem] lg:min-h-0">
                      <div class="absolute inset-0 overflow-y-auto space-y-1.5 pr-1">
                        <div *ngFor="let n of cn" class="flex items-center gap-2 border border-slate-100 rounded-md px-3 py-2">
                          <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          <span class="text-sm text-slate-700 truncate">{{ n }}</span>
                        </div>
                      </div>
                    </div>
                  </ng-container>
                  <ng-template #sinNuevos>
                    <div class="flex-1 min-h-[18rem] lg:min-h-0 flex items-center justify-center text-sm text-slate-400 italic">
                      Sin clientes nuevos este mes.
                    </div>
                  </ng-template>
                </ng-container>
              </div>

              <!-- Cobertura Producto Foco (tarjeta separada) -->
              <div class="bg-white rounded-xl border border-slate-100 p-5">
                <div class="flex items-center justify-between gap-2 mb-4">
                  <h3 class="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                    </svg>
                    Cobertura Producto Foco
                  </h3>
                </div>
                <p class="text-[11px] uppercase text-slate-500 font-medium mb-3">Top 3 productos foco del mes</p>
                <ng-container *ngIf="coberturasFoco() as focos">
                  <div *ngIf="focos.length === 0" class="text-sm text-slate-400 italic">Sin ventas en el mes.</div>
                  <div class="space-y-3">
                    <div *ngFor="let cf of focos; let i = index" class="bg-emerald-50/60 border border-emerald-100 rounded-lg p-4">
                      <div class="flex items-start justify-between gap-2 mb-3">
                        <div class="min-w-0">
                          <p class="text-xs text-slate-500">Producto {{ i + 1 }}</p>
                          <p class="text-sm font-bold text-slate-900 truncate" [title]="cf.foco">{{ cf.foco || '—' }}</p>
                        </div>
                        <div class="text-right shrink-0">
                          <p class="text-xs text-slate-500">Clientes con producto</p>
                          <p class="text-2xl font-bold text-emerald-600">{{ cf.clientesConProducto }}</p>
                        </div>
                      </div>
                      <div class="grid grid-cols-3 gap-2 mb-3">
                        <div class="bg-white rounded-md p-2 text-center border border-emerald-100/60">
                          <p class="text-[10px] text-slate-500">Ventas Brutas</p>
                          <p class="text-sm font-bold text-slate-900">{{ formatoCLP(cf.ventasBrutas) }}</p>
                        </div>
                        <div class="bg-white rounded-md p-2 text-center border border-emerald-100/60">
                          <p class="text-[10px] text-slate-500">Margen $</p>
                          <p class="text-sm font-bold text-emerald-600">{{ formatoCLP(cf.margen) }}</p>
                        </div>
                        <div class="bg-white rounded-md p-2 text-center border border-emerald-100/60">
                          <p class="text-[10px] text-slate-500">Margen %</p>
                          <p class="text-sm font-bold text-violet-600">{{ cf.margenPct | number:'1.0-0' }}%</p>
                        </div>
                      </div>
                      <div class="flex items-center justify-between mb-1">
                        <p class="text-sm text-slate-600">Cobertura</p>
                        <p class="text-sm font-bold text-slate-900">{{ cf.cobertura | number:'1.0-0' }}%</p>
                      </div>
                      <app-progress-bar [valor]="cf.cobertura" [alto]="6" color="#10b981"></app-progress-bar>
                      <p class="text-xs text-slate-500 text-center mt-1">{{ cf.clientesConProducto }} de {{ cf.totalClientes }} clientes</p>
                    </div>
                  </div>
                </ng-container>
              </div>

              <!-- Cobranza (tarjeta separada) -->
              <div class="bg-white rounded-xl border border-slate-100 p-5">
                <h3 class="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
                  </svg>
                  Cobranza
                </h3>
                <ng-container *ngIf="cobranza() as cb">
                  <div *ngIf="cb.items.length === 0" class="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                    <p class="text-sm text-slate-500">Sin datos de cobranza</p>
                    <p class="text-xs text-slate-400 mt-1">
                      Los días de atraso y montos en mora no están en el CSV de ventas.
                      Sube un archivo de cobranza en Datos para activar esta tabla.
                    </p>
                  </div>
                  <div *ngIf="cb.items.length > 0" class="overflow-x-auto">
                    <table class="w-full">
                      <thead class="text-xs uppercase text-slate-500 border-b border-slate-100">
                        <tr>
                          <th class="text-left px-2 py-2 font-semibold">Cliente</th>
                          <th class="text-right px-2 py-2 font-semibold whitespace-nowrap">Días atraso</th>
                          <th class="text-right px-2 py-2 font-semibold">%</th>
                          <th class="text-right px-2 py-2 font-semibold whitespace-nowrap">Mora (CLP)</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100">
                        <tr *ngFor="let it of cb.items" class="hover:bg-slate-50">
                          <td class="px-2 py-3 text-sm text-slate-900 truncate max-w-[180px]" [title]="it.cliente">{{ it.cliente }}</td>
                          <td class="px-2 py-3 text-right text-sm text-slate-700">{{ it.dias }}</td>
                          <td class="px-2 py-3 text-right text-sm font-medium"
                              [class.text-rose-600]="it.porcentaje >= 60"
                              [class.text-amber-600]="it.porcentaje >= 30 && it.porcentaje < 60"
                              [class.text-slate-600]="it.porcentaje < 30">{{ it.porcentaje | number:'1.0-0' }}%</td>
                          <td class="px-2 py-3 text-right text-sm font-semibold text-rose-600 whitespace-nowrap">{{ formatoCLP(it.moraClp) }}</td>
                        </tr>
                      </tbody>
                      <tfoot class="border-t border-slate-200">
                        <tr>
                          <td class="px-2 py-3 text-sm font-semibold text-slate-900" colspan="3">Total Mora</td>
                          <td class="px-2 py-3 text-right text-sm font-bold text-rose-600 whitespace-nowrap">{{ formatoCLP(cb.totalMora) }}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </ng-container>
              </div>
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

            <!-- Matriz de cumplimiento mensual -->
            <div class="bg-white rounded-xl border border-slate-100 p-5" *ngIf="matrizCumplimiento() as mx">
              <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 class="text-base font-semibold text-slate-900">Matriz de cumplimiento</h3>
                <div class="flex items-center gap-2 text-xs">
                  <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-emerald-200"></span>≥100%</span>
                  <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-amber-200"></span>80–99%</span>
                  <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-rose-200"></span>&lt;80%</span>
                  <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-slate-100"></span>sin meta</span>
                </div>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr>
                      <th *ngFor="let m of MESES_CORTO" class="text-center text-[11px] uppercase text-slate-500 font-semibold px-1 py-2">{{ m }}</th>
                      <th class="text-center text-[11px] uppercase text-slate-500 font-semibold px-2 py-2">Año</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td *ngFor="let c of mx.meses" class="px-1 py-1 align-top">
                        <div class="rounded py-2 text-center min-w-[44px]" [class]="claseCelda(c)">
                          <p class="text-xs font-bold">{{ c.meta > 0 ? (c.pct | number:'1.0-0') + '%' : '—' }}</p>
                          <p class="text-[10px] opacity-75">{{ c.meta > 0 ? compactCLP(c.vendido) : '' }}</p>
                        </div>
                      </td>
                      <td class="px-2 py-1 align-top">
                        <div class="rounded py-2 text-center bg-slate-50 min-w-[70px]">
                          <p class="text-xs font-bold" [class]="colorTextoPct(mx.pctAnual)">
                            {{ mx.metaAnual > 0 ? (mx.pctAnual | number:'1.0-0') + '%' : '—' }}
                          </p>
                          <p class="text-[10px] text-slate-500">{{ compactCLP(mx.vendidoAnual) }} / {{ compactCLP(mx.metaAnual) }}</p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Productos Top en Ventas -->
            <div class="bg-white rounded-xl border border-slate-100 p-5">
              <h3 class="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>
                </svg>
                Productos Top en Ventas
              </h3>
              <ng-container *ngIf="topProductos() as productos">
                <div *ngIf="productos.length === 0" class="text-sm text-slate-400 italic">Sin ventas en el mes.</div>
                <div *ngIf="productos.length > 0" class="overflow-x-auto">
                  <table class="w-full">
                    <thead class="text-xs uppercase text-slate-500 border-b border-slate-100">
                      <tr>
                        <th class="text-left px-2 py-2 font-semibold">#</th>
                        <th class="text-left px-2 py-2 font-semibold min-w-[160px]">Nombre del Producto</th>
                        <th class="text-left px-2 py-2 font-semibold">Tipo</th>
                        <th class="text-right px-2 py-2 font-semibold whitespace-nowrap">Precio Prom.</th>
                        <th class="text-right px-2 py-2 font-semibold whitespace-nowrap">Ventas Brutas</th>
                        <th class="text-right px-2 py-2 font-semibold whitespace-nowrap">Margen $</th>
                        <th class="text-right px-2 py-2 font-semibold whitespace-nowrap">Margen %</th>
                        <th class="text-right px-2 py-2 font-semibold whitespace-nowrap">Descuentos %</th>
                        <th class="text-left px-2 py-2 font-semibold whitespace-nowrap">Cobertura</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      <tr *ngFor="let p of productos; let i = index" class="hover:bg-slate-50">
                        <td class="px-2 py-3">
                          <span class="w-6 h-6 inline-flex items-center justify-center rounded-full text-white text-xs font-bold"
                                [class.bg-amber-400]="i === 0"
                                [class.bg-slate-400]="i === 1"
                                [class.bg-orange-400]="i === 2"
                                [class.bg-sky-600]="i > 2">{{ i + 1 }}</span>
                        </td>
                        <td class="px-2 py-3">
                          <p class="text-sm font-medium text-slate-900 truncate max-w-[200px]" [title]="p.nombre">{{ p.nombre }}</p>
                          <p *ngIf="p.marca" class="text-xs text-slate-400">{{ p.marca }}</p>
                        </td>
                        <td class="px-2 py-3">
                          <span *ngIf="p.tipo" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" [class]="colorTipo(p.tipo)">{{ p.tipo }}</span>
                          <span *ngIf="!p.tipo" class="text-xs text-slate-400">—</span>
                        </td>
                        <td class="px-2 py-3 text-right text-sm text-slate-700 whitespace-nowrap">{{ formatoCLP(p.precioPromedio) }}</td>
                        <td class="px-2 py-3 text-right text-sm font-semibold text-sky-600 whitespace-nowrap">{{ formatoCLP(p.ventasMonto) }}</td>
                        <td class="px-2 py-3 text-right text-sm font-semibold text-emerald-600 whitespace-nowrap">{{ formatoCLP(p.margen) }}</td>
                        <td class="px-2 py-3 text-right text-sm font-medium text-emerald-600">{{ p.margenPct | number:'1.0-0' }}%</td>
                        <td class="px-2 py-3 text-right text-sm font-medium" [class.text-rose-500]="p.descuentoPct >= 8" [class.text-amber-600]="p.descuentoPct >= 4 && p.descuentoPct < 8" [class.text-slate-500]="p.descuentoPct < 4">{{ p.descuentoPct | number:'1.0-0' }}%</td>
                        <td class="px-2 py-3">
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-semibold text-violet-600 w-6 text-right">{{ p.clientesUnicos }}</span>
                            <div class="w-16">
                              <app-progress-bar [valor]="p.pctCoberturaSobreMax" [alto]="6" color="#8b5cf6"></app-progress-bar>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </ng-container>
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
  gruposDiasService = inject(GruposDiasService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  listoParaCalcular = signal(false);
  mesSeleccionado = signal<number>(new Date().getMonth() + 1);
  seleccionado = signal<string | null>(null);

  MESES_LARGO = MESES_LARGO;
  MESES_CORTO = MESES_CORTO;

  private historialChart?: Chart;

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);

    effect(() => {
      const anio = this.dataset.anioActivo();
      if (anio != null && this.metasService.anioCargado() !== anio) {
        this.metasService.cargarAnio(anio);
      }
    });

    // Días laborales del año activo, para proyectar con días hábiles.
    effect(() => {
      const anio = this.dataset.anioActivo();
      if (anio != null && this.gruposDiasService.anioCargado() !== anio) {
        this.gruposDiasService.cargarAnio(anio);
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

  // Cuenta días de semana (L-V) entre el día 1 y `hasta` (inclusive) del mes.
  private contarDiasSemana(anio: number, mes: number, hasta: number): number {
    let n = 0;
    for (let d = 1; d <= hasta; d++) {
      const dow = new Date(anio, mes - 1, d).getDay();
      if (dow !== 0 && dow !== 6) n++;
    }
    return n;
  }

  // Días laborales totales del mes: los configurados en DATOS o, si no hay,
  // los días de semana (L-V) del mes como aproximación.
  private diasLaboralesTotales = computed(() => {
    const anio = this.dataset.anioActivo() ?? new Date().getFullYear();
    const mes = this.mesSeleccionado();
    const configurado = this.gruposDiasService.diasDelMes(mes);
    if (configurado > 0) return configurado;
    const diasMes = new Date(anio, mes, 0).getDate();
    return this.contarDiasSemana(anio, mes, diasMes);
  });

  // Días laborales transcurridos hasta el día de corte (día de semana elapsed).
  private diasLaboralesTranscurridos = computed(() => {
    const anio = this.dataset.anioActivo() ?? new Date().getFullYear();
    const mes = this.mesSeleccionado();
    const corte = this.diaCorte();
    if (corte <= 0) return 0;
    const habiles = this.contarDiasSemana(anio, mes, corte);
    // No exceder el total configurado.
    return Math.min(habiles, this.diasLaboralesTotales());
  });

  private factorProyeccion = computed(() => {
    const anio = this.dataset.anioActivo();
    const mes = this.mesSeleccionado();
    const hoy = new Date();
    if (anio == null) return 1;
    if (anio < hoy.getFullYear() || (anio === hoy.getFullYear() && mes < hoy.getMonth() + 1)) return 1;
    if (anio > hoy.getFullYear() || (anio === hoy.getFullYear() && mes > hoy.getMonth() + 1)) return 0;
    // Proyección por días laborales: total / transcurridos.
    const total = this.diasLaboralesTotales();
    const transcurridos = this.diasLaboralesTranscurridos();
    return transcurridos > 0 ? total / transcurridos : 0;
  });

  // Días del mes calendario (para el día de corte del período).
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

    // Venta diaria necesaria = por día laboral restante (no día calendario).
    const diasRestantes = Math.max(0, this.diasLaboralesTotales() - this.diasLaboralesTranscurridos());
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
      const corte = Math.min(this.diaCorte() || diasMesAnt, diasMesAnt);
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

  // Métrica de visitas que generará el vendedor desde la app móvil.
  // Hasta integrarla queda en null → las cards de visitas muestran "—".
  visitasApp = signal<number | null>(null);
  // Nombres de clientes no visitados provistos por la app (pendiente de integración).
  noVisitadosApp = signal<string[]>([]);

  cartera = computed<{
    total: number;
    conVentas: number;
    visitados: number | null;
    sinVisitar: number;
    tasaVisita: number | null;
    noVisitados: string[];
  } | null>(() => {
    if (!this.vendedorSeleccionado()) return null;
    const { mes, anio } = this.registrosVendedor();
    const total = new Set<string>();
    const conVentas = new Set<string>();
    for (const r of anio) if (r.clienteRut) total.add(r.clienteRut.trim());
    for (const r of mes) if (r.clienteRut) conVentas.add(r.clienteRut.trim());

    const visitados = this.visitasApp();
    const sinVisitar = visitados == null ? total.size : Math.max(0, total.size - visitados);
    const tasaVisita = visitados == null || total.size === 0 ? null : (visitados / total.size) * 100;
    return {
      total: total.size,
      conVentas: conVentas.size,
      visitados,
      sinVisitar,
      tasaVisita,
      noVisitados: this.noVisitadosApp(),
    };
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
      descuentoBruto: number;
      docs: Set<string>;
      clientes: Set<string>;
      marcas: Map<string, number>;
      tipos: Map<string, number>;
    };
    const map = new Map<string, Acum>();
    for (const r of mes) {
      const nombre = (r.producto || '').trim();
      if (!nombre) continue;
      let prev = map.get(nombre);
      if (!prev) {
        prev = { ventasMonto: 0, margen: 0, unidades: 0, descuentoBruto: 0, docs: new Set(), clientes: new Set(), marcas: new Map(), tipos: new Map() };
        map.set(nombre, prev);
      }
      prev.ventasMonto += r.ventaTotalBruta;
      prev.margen += r.margen;
      prev.unidades += r.cantidad || 0;
      prev.descuentoBruto += r.descuentoBruto || 0;
      if (r.numeroDocumento) prev.docs.add(r.numeroDocumento);
      if (r.clienteRut) prev.clientes.add(r.clienteRut.trim());
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
      // Descuento como % sobre la venta bruta antes de descuento.
      descuentoPct: x.ventasMonto + x.descuentoBruto > 0
        ? (x.descuentoBruto / (x.ventasMonto + x.descuentoBruto)) * 100
        : 0,
      clientesUnicos: x.clientes.size,
      pctMargenSobreMax: 0,
      pctVentasSobreMax: 0,
      pctUnidadesSobreMax: 0,
      pctCoberturaSobreMax: 0,
    }));
    arr.sort((a, b) => b.ventasMonto - a.ventasMonto);
    const top = arr.slice(0, 10);
    const maxV = Math.max(0, ...top.map((p) => p.ventasMonto));
    const maxM = Math.max(0, ...top.map((p) => p.margen));
    const maxU = Math.max(0, ...top.map((p) => p.unidades));
    const maxC = Math.max(0, ...top.map((p) => p.clientesUnicos));
    top.forEach((p) => {
      p.pctVentasSobreMax = maxV > 0 ? (p.ventasMonto / maxV) * 100 : 0;
      p.pctMargenSobreMax = maxM > 0 ? (p.margen / maxM) * 100 : 0;
      p.pctUnidadesSobreMax = maxU > 0 ? (p.unidades / maxU) * 100 : 0;
      p.pctCoberturaSobreMax = maxC > 0 ? (p.clientesUnicos / maxC) * 100 : 0;
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

  // ---------- Matriz de cumplimiento (12 meses + año) ----------
  matrizCumplimiento = computed<{
    meses: { meta: number; vendido: number; pct: number }[];
    metaAnual: number;
    vendidoAnual: number;
    pctAnual: number;
  } | null>(() => {
    const v = this.vendedorSeleccionado();
    if (!v) return null;
    const anio = this.dataset.anioActivo();
    const vendido = this.historialMensual().data;
    const norm = (s: string) => s.trim().toUpperCase();
    const target = norm(v.nombre);

    const metaMes = Array(12).fill(0);
    for (const m of this.metasService.metas()) {
      if (m.anio !== anio || norm(m.vendedor) !== target) continue;
      if (m.mes >= 1 && m.mes <= 12) metaMes[m.mes - 1] += m.metaClp;
    }

    const meses: { meta: number; vendido: number; pct: number }[] = [];
    let metaAnual = 0;
    let vendidoAnual = 0;
    for (let i = 0; i < 12; i++) {
      const meta = metaMes[i];
      const vend = vendido[i] ?? 0;
      metaAnual += meta;
      vendidoAnual += vend;
      meses.push({ meta, vendido: vend, pct: meta > 0 ? (vend / meta) * 100 : 0 });
    }
    return { meses, metaAnual, vendidoAnual, pctAnual: metaAnual > 0 ? (vendidoAnual / metaAnual) * 100 : 0 };
  });

  // ---------- Cobertura: top 3 productos foco del mes ----------
  coberturasFoco = computed<{
    foco: string;
    ventasBrutas: number;
    margen: number;
    margenPct: number;
    clientesConProducto: number;
    totalClientes: number;
    cobertura: number;
  }[]>(() => {
    const v = this.vendedorSeleccionado();
    if (!v) return [];
    const { mes } = this.registrosVendedor();
    const totalClientes = this.cartera()?.total ?? 0;

    // Top 3 productos por venta bruta del mes.
    const tot = new Map<string, number>();
    for (const r of mes) {
      const p = (r.producto || '').trim();
      if (p) tot.set(p, (tot.get(p) ?? 0) + r.ventaTotalBruta);
    }
    const focos = Array.from(tot.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([p]) => p);

    return focos.map((foco) => {
      let ventasBrutas = 0;
      let margen = 0;
      const clientes = new Set<string>();
      for (const r of mes) {
        if ((r.producto || '').trim() !== foco) continue;
        ventasBrutas += r.ventaTotalBruta;
        margen += r.margen;
        if (r.clienteRut) clientes.add(r.clienteRut.trim());
      }
      return {
        foco,
        ventasBrutas,
        margen,
        margenPct: ventasBrutas > 0 ? (margen / ventasBrutas) * 100 : 0,
        clientesConProducto: clientes.size,
        totalClientes,
        cobertura: totalClientes > 0 ? (clientes.size / totalClientes) * 100 : 0,
      };
    });
  });

  // ---------- Cobranza ----------
  // Filas provistas por el archivo/integración de cobranza (pendiente).
  // El cálculo de "mora" y "%" se ajustará cuando definas la fórmula.
  cobranzaApp = signal<CobranzaItem[]>([]);

  cobranza = computed<{ items: CobranzaItem[]; totalMora: number }>(() => {
    if (!this.vendedorSeleccionado()) return { items: [], totalMora: 0 };
    const items = this.cobranzaApp();
    const totalMora = items.reduce((acc, it) => acc + it.moraClp, 0);
    return { items, totalMora };
  });

  compactCLP(n: number): string {
    if (!n) return '$0';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  claseCelda(c: { meta: number; pct: number }): string {
    if (c.meta === 0) return 'bg-slate-100 text-slate-400';
    if (c.pct >= 100) return 'bg-emerald-100 text-emerald-700';
    if (c.pct >= 80) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  }

  private paletaTipo = [
    'bg-violet-100 text-violet-700',
    'bg-sky-100 text-sky-700',
    'bg-emerald-100 text-emerald-700',
    'bg-cyan-100 text-cyan-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-indigo-100 text-indigo-700',
    'bg-slate-100 text-slate-700',
  ];

  colorTipo(tipo: string): string {
    if (!tipo) return 'bg-slate-100 text-slate-500';
    let h = 0;
    for (let i = 0; i < tipo.length; i++) h = (h * 31 + tipo.charCodeAt(i)) >>> 0;
    return this.paletaTipo[h % this.paletaTipo.length];
  }

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
