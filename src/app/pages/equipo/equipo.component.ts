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
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { DatasetService } from '../../services/dataset.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { ProgressBarComponent } from '../../shared/progress-bar/progress-bar.component';
import { colorPorNombre, iniciales } from '../../utils/colores';

Chart.register(...registerables);

interface ResumenVendedor {
  nombre: string;
  iniciales: string;
  color: string;
  ventas: number;
  margen: number;
  margenPct: number;
  lineas: number;
  clientesUnicos: number;
  ranking: number;
  pctSobreMax: number;
  rendimiento: 'Excelente' | 'Bueno' | 'Regular' | 'Bajo';
  porMes: number[];
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Component({
  selector: 'app-equipo',
  standalone: true,
  imports: [CommonModule, AvatarComponent, BadgeComponent, ProgressBarComponent, EmptyStateComponent],
  template: `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Equipo de Ventas</h1>
      <p class="text-sm text-slate-500 mt-1">
        Rendimiento individual {{ dataset.anioActivo() ? '· Año ' + dataset.anioActivo() : '' }}
      </p>
    </div>

    <ng-container *ngIf="dataset.cargando() || !listoParaCalcular(); else listo">
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-12 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <span class="inline-block w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
        <span>Cargando equipo...</span>
      </div>
    </ng-container>

    <ng-template #listo>
      <ng-container *ngIf="dataset.registros().length === 0; else ok">
        <app-empty-state
          titulo="Sin datos cargados"
          descripcion="Carga un CSV con ventas para ver el rendimiento del equipo."
          enlace="/datos"
          enlaceLabel="Ir a Datos"
        ></app-empty-state>
      </ng-container>

      <ng-template #ok>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div
            *ngFor="let v of resumen()"
            (click)="seleccionar(v.nombre)"
            class="bg-white rounded-xl shadow-card border border-slate-100 p-5 cursor-pointer hover:border-brand-500 transition"
            [class.ring-2]="seleccionado() === v.nombre"
            [class.ring-brand-500]="seleccionado() === v.nombre"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <app-avatar [iniciales]="v.iniciales" [color]="v.color" size="lg"></app-avatar>
                <div class="min-w-0">
                  <p class="font-semibold text-slate-900 truncate">{{ v.nombre }}</p>
                  <p class="text-xs text-slate-500">Ranking #{{ v.ranking }}</p>
                </div>
              </div>
              <app-badge [tono]="tonoRendimiento(v.rendimiento)">{{ v.rendimiento }}</app-badge>
            </div>

            <div class="grid grid-cols-2 gap-3 mt-4">
              <div>
                <p class="text-xs text-slate-500">Ventas</p>
                <p class="text-lg font-bold text-slate-900">{{ formatoCLP(v.ventas) }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-500">Margen</p>
                <p class="text-lg font-bold text-emerald-600">{{ formatoCLP(v.margen) }}</p>
              </div>
            </div>

            <div class="mt-3">
              <div class="flex justify-between text-xs text-slate-600 mb-1">
                <span>vs Top Vendedor</span>
                <span class="font-semibold">{{ v.pctSobreMax | number:'1.0-0' }}%</span>
              </div>
              <app-progress-bar [valor]="v.pctSobreMax"></app-progress-bar>
            </div>

            <div class="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-600 pt-4 border-t border-slate-100">
              <div>
                <p class="text-slate-400">% Margen</p>
                <p class="font-bold text-slate-700 mt-0.5">{{ v.margenPct | number:'1.1-1' }}%</p>
              </div>
              <div>
                <p class="text-slate-400">Líneas</p>
                <p class="font-bold text-slate-700 mt-0.5">{{ v.lineas | number }}</p>
              </div>
              <div>
                <p class="text-slate-400">Clientes</p>
                <p class="font-bold text-slate-700 mt-0.5">{{ v.clientesUnicos | number }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 mb-6">
          <h3 class="text-base font-semibold text-slate-900 mb-4">Resumen del Equipo</h3>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="rounded-lg p-4 bg-emerald-50 border border-emerald-100">
              <p class="text-3xl font-bold text-emerald-700">{{ resumenEquipo().excelente }}</p>
              <p class="text-xs text-emerald-700 font-medium mt-1">Excelentes</p>
            </div>
            <div class="rounded-lg p-4 bg-sky-50 border border-sky-100">
              <p class="text-3xl font-bold text-sky-700">{{ resumenEquipo().bueno }}</p>
              <p class="text-xs text-sky-700 font-medium mt-1">Buen rendimiento</p>
            </div>
            <div class="rounded-lg p-4 bg-amber-50 border border-amber-100">
              <p class="text-3xl font-bold text-amber-700">{{ resumenEquipo().regular }}</p>
              <p class="text-xs text-amber-700 font-medium mt-1">Regular</p>
            </div>
            <div class="rounded-lg p-4 bg-rose-50 border border-rose-100">
              <p class="text-3xl font-bold text-rose-700">{{ resumenEquipo().bajo }}</p>
              <p class="text-xs text-rose-700 font-medium mt-1">Bajo</p>
            </div>
          </div>
        </div>

        <div *ngIf="vendedorSel() as v" class="bg-blue-50/40 rounded-xl border border-blue-100 p-5 mb-6">
          <div class="flex items-center justify-between mb-5">
            <div class="flex items-center gap-3">
              <app-avatar [iniciales]="v.iniciales" [color]="v.color" size="xl"></app-avatar>
              <div>
                <h3 class="text-lg font-bold text-slate-900">Detalle de {{ v.nombre }}</h3>
                <p class="text-sm text-slate-500">Desempeño mensual del año {{ dataset.anioActivo() }}</p>
              </div>
            </div>
            <button (click)="seleccionado.set(null)" class="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div class="bg-white rounded-xl border border-slate-100 p-5">
              <p class="text-xs text-slate-500">Total Ventas</p>
              <p class="text-2xl font-bold text-slate-900 mt-1">{{ formatoCLP(v.ventas) }}</p>
              <p class="text-xs text-slate-500 mt-1">{{ v.lineas | number }} líneas</p>
            </div>
            <div class="bg-white rounded-xl border border-slate-100 p-5">
              <p class="text-xs text-slate-500">Margen Neto</p>
              <p class="text-2xl font-bold text-emerald-600 mt-1">{{ formatoCLP(v.margen) }}</p>
              <p class="text-xs text-slate-500 mt-1">{{ v.margenPct | number:'1.1-1' }}% margen</p>
            </div>
            <div class="bg-white rounded-xl border border-slate-100 p-5">
              <p class="text-xs text-slate-500">Cartera de Clientes</p>
              <p class="text-2xl font-bold text-sky-600 mt-1">{{ v.clientesUnicos | number }}</p>
              <p class="text-xs text-slate-500 mt-1">Clientes únicos</p>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-100 p-5">
            <h4 class="text-sm font-semibold text-slate-900 mb-4">Ventas por Mes</h4>
            <div class="h-64"><canvas #histCanvas></canvas></div>
          </div>
        </div>
      </ng-template>
    </ng-template>
  `,
})
export class EquipoComponent implements OnDestroy {
  histCanvas = viewChild<ElementRef<HTMLCanvasElement>>('histCanvas');
  dataset = inject(DatasetService);
  seleccionado = signal<string | null>(null);
  listoParaCalcular = signal(false);
  private historialChart?: Chart;

  resumen = computed<ResumenVendedor[]>(() => {
    const rows = this.dataset.registros();
    const map = new Map<string, { ventas: number; margen: number; lineas: number; clientes: Set<string>; porMes: number[] }>();
    for (const r of rows) {
      const v = r.vendedor?.trim();
      if (!v) continue;
      let prev = map.get(v);
      if (!prev) {
        prev = { ventas: 0, margen: 0, lineas: 0, clientes: new Set<string>(), porMes: Array(12).fill(0) };
        map.set(v, prev);
      }
      prev.ventas += r.ventaTotalBruta;
      prev.margen += r.margen;
      prev.lineas += 1;
      if (r.clienteRut) prev.clientes.add(r.clienteRut);
      if (r.mes >= 1 && r.mes <= 12) prev.porMes[r.mes - 1] += r.ventaTotalBruta;
    }
    const arr = Array.from(map.entries()).map(([nombre, x]) => ({
      nombre,
      iniciales: iniciales(nombre),
      color: colorPorNombre(nombre),
      ventas: x.ventas,
      margen: x.margen,
      margenPct: x.ventas > 0 ? (x.margen / x.ventas) * 100 : 0,
      lineas: x.lineas,
      clientesUnicos: x.clientes.size,
      ranking: 0,
      pctSobreMax: 0,
      rendimiento: 'Bueno' as ResumenVendedor['rendimiento'],
      porMes: x.porMes,
    }));
    arr.sort((a, b) => b.ventas - a.ventas);
    const max = arr[0]?.ventas ?? 1;
    arr.forEach((v, i) => {
      v.ranking = i + 1;
      v.pctSobreMax = max > 0 ? (v.ventas / max) * 100 : 0;
      if (v.pctSobreMax >= 80) v.rendimiento = 'Excelente';
      else if (v.pctSobreMax >= 50) v.rendimiento = 'Bueno';
      else if (v.pctSobreMax >= 25) v.rendimiento = 'Regular';
      else v.rendimiento = 'Bajo';
    });
    return arr;
  });

  resumenEquipo = computed(() => {
    const r = this.resumen();
    return {
      excelente: r.filter((v) => v.rendimiento === 'Excelente').length,
      bueno: r.filter((v) => v.rendimiento === 'Bueno').length,
      regular: r.filter((v) => v.rendimiento === 'Regular').length,
      bajo: r.filter((v) => v.rendimiento === 'Bajo').length,
    };
  });

  vendedorSel = computed<ResumenVendedor | null>(() => {
    const nombre = this.seleccionado();
    if (!nombre) return null;
    return this.resumen().find((v) => v.nombre === nombre) ?? null;
  });

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);
    effect(() => {
      const canvas = this.histCanvas();
      const sel = this.vendedorSel();
      if (!canvas) return;
      queueMicrotask(() => this.renderHistorial(canvas, sel));
    });
  }

  ngOnDestroy(): void {
    this.historialChart?.destroy();
  }

  seleccionar(nombre: string) {
    this.seleccionado.set(this.seleccionado() === nombre ? null : nombre);
  }

  formatoCLP(n: number): string {
    return '$' + (Math.round(n) || 0).toLocaleString('es-CL');
  }

  tonoRendimiento(r: string): 'verde' | 'azul' | 'amarillo' | 'rojo' {
    return r === 'Excelente' ? 'verde' : r === 'Bueno' ? 'azul' : r === 'Regular' ? 'amarillo' : 'rojo';
  }

  private renderHistorial(
    canvas: ElementRef<HTMLCanvasElement>,
    v: ResumenVendedor | null,
  ): void {
    this.historialChart?.destroy();
    if (!v) return;

    const cfg: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: MESES,
        datasets: [
          {
            label: 'Ventas',
            data: v.porMes,
            borderColor: v.color,
            backgroundColor: v.color + '22',
            tension: 0.35,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#fff',
            pointBorderColor: v.color,
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { font: { size: 10 } }, grid: { color: '#f1f5f9' } },
          x: { ticks: { font: { size: 10 } }, grid: { display: false } },
        },
      },
    };
    this.historialChart = new Chart(canvas.nativeElement, cfg);
  }
}
