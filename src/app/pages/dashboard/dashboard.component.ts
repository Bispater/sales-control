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
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { KpiCardComponent } from '../../shared/kpi-card/kpi-card.component';
import { ProgressBarComponent } from '../../shared/progress-bar/progress-bar.component';
import { colorPorNombre, iniciales } from '../../utils/colores';

Chart.register(...registerables);

interface DesempenoVendedor {
  nombre: string;
  iniciales: string;
  color: string;
  ventas: number;
  margen: number;
  margenPct: number;
  cantidad: number;
  pctSobreMax: number;
}

const MESES_LARGO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, KpiCardComponent, AvatarComponent, ProgressBarComponent, EmptyStateComponent],
  template: `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Control de Ventas</h1>
        <p class="text-sm text-slate-500 mt-1">
          {{ dataset.anioActivo() ? 'Resumen ejecutivo · Año ' + dataset.anioActivo() : 'Resumen ejecutivo' }}
        </p>
      </div>
    </div>

    <ng-container *ngIf="dataset.cargando() || !listoParaCalcular(); else contenido">
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-12 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <span class="inline-block w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
        <span>Cargando dashboard del año {{ dataset.anioActivo() }}...</span>
      </div>
    </ng-container>

    <ng-template #contenido>
      <ng-container *ngIf="dataset.registros().length === 0; else dataReady">
        <app-empty-state
          titulo="Sin datos cargados"
          descripcion="Aún no has subido ningún dataset. Carga un archivo CSV con tus ventas en la sección Datos."
          enlace="/datos"
          enlaceLabel="Ir a Datos"
        ></app-empty-state>
      </ng-container>

      <ng-template #dataReady>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <app-kpi-card
            titulo="Ventas Totales"
            [valor]="formatoCLP(kpis().ventasTotales)"
            [subtitulo]="kpis().transacciones + ' transacciones'"
          ></app-kpi-card>

          <app-kpi-card
            titulo="Margen Neto"
            [valor]="formatoCLP(kpis().margenTotal)"
            [subtitulo]="(kpis().margenPct | number:'1.1-1') + '% margen'"
          ></app-kpi-card>

          <app-kpi-card
            titulo="Venta Promedio"
            [valor]="formatoCLP(kpis().promedio)"
            [subtitulo]="kpis().filas + ' registros'"
          ></app-kpi-card>

          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Mejor Vendedor</p>
            <div class="flex items-center gap-3 mt-2" *ngIf="kpis().mejorVendedor as mv">
              <app-avatar [iniciales]="mv.iniciales" [color]="mv.color" size="md"></app-avatar>
              <div class="min-w-0">
                <p class="text-base font-bold text-slate-900 truncate">{{ mv.nombre }}</p>
                <p class="text-xs text-slate-500">{{ formatoCLP(mv.ventas) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <h3 class="text-base font-semibold text-slate-900 mb-4">Tendencia Mensual</h3>
            <div class="h-64"><canvas #tendencia></canvas></div>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <h3 class="text-base font-semibold text-slate-900 mb-4">Ventas por Vendedor</h3>
            <div class="h-64"><canvas #barras></canvas></div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
          <div class="p-5 border-b border-slate-100">
            <h3 class="text-base font-semibold text-slate-900">Desempeño por Vendedor</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th class="text-left px-5 py-3 font-semibold">Vendedor</th>
                  <th class="text-left px-5 py-3 font-semibold">% del Top</th>
                  <th class="text-left px-5 py-3 font-semibold">Ventas</th>
                  <th class="text-left px-5 py-3 font-semibold">Margen</th>
                  <th class="text-left px-5 py-3 font-semibold">Líneas</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr *ngFor="let v of desempeno()" class="hover:bg-slate-50">
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-3">
                      <app-avatar [iniciales]="v.iniciales" [color]="v.color"></app-avatar>
                      <p class="text-sm font-medium text-slate-900">{{ v.nombre }}</p>
                    </div>
                  </td>
                  <td class="px-5 py-3 w-64">
                    <div class="flex items-center gap-2">
                      <div class="flex-1">
                        <app-progress-bar [valor]="v.pctSobreMax"></app-progress-bar>
                      </div>
                      <span class="text-xs font-semibold text-slate-700 w-12 text-right">
                        {{ v.pctSobreMax | number:'1.0-0' }}%
                      </span>
                    </div>
                  </td>
                  <td class="px-5 py-3 text-sm font-semibold text-slate-900">{{ formatoCLP(v.ventas) }}</td>
                  <td class="px-5 py-3">
                    <div class="text-sm font-semibold text-emerald-600">{{ formatoCLP(v.margen) }}</div>
                    <div class="text-xs text-slate-500">{{ v.margenPct | number:'1.1-1' }}%</div>
                  </td>
                  <td class="px-5 py-3">
                    <span class="inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-full bg-sky-100 text-sky-700 text-sm font-semibold">
                      {{ v.cantidad | number }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-template>
    </ng-template>
  `,
})
export class DashboardComponent implements OnDestroy {
  tendenciaCanvas = viewChild<ElementRef<HTMLCanvasElement>>('tendencia');
  barrasCanvas = viewChild<ElementRef<HTMLCanvasElement>>('barras');
  dataset = inject(DatasetService);
  listoParaCalcular = signal(false);

  private charts: Chart[] = [];

  kpis = computed(() => {
    const rows = this.dataset.registros();
    let ventas = 0;
    let margen = 0;
    const docs = new Set<string>();
    const porVendedor = new Map<string, number>();
    for (const r of rows) {
      ventas += r.ventaTotalBruta;
      margen += r.margen;
      if (r.numeroDocumento) docs.add(r.numeroDocumento + '|' + r.sucursal);
      if (r.vendedor) porVendedor.set(r.vendedor, (porVendedor.get(r.vendedor) ?? 0) + r.ventaTotalBruta);
    }
    type MejorVendedor = { nombre: string; iniciales: string; color: string; ventas: number };
    let mejor: MejorVendedor | null = null;
    let max = 0;
    for (const [nombre, v] of porVendedor) {
      if (v > max) {
        max = v;
        mejor = { nombre, iniciales: iniciales(nombre), color: colorPorNombre(nombre), ventas: v };
      }
    }
    return {
      ventasTotales: ventas,
      margenTotal: margen,
      margenPct: ventas > 0 ? (margen / ventas) * 100 : 0,
      transacciones: docs.size,
      filas: rows.length,
      promedio: docs.size > 0 ? ventas / docs.size : 0,
      mejorVendedor: mejor,
    };
  });

  desempeno = computed<DesempenoVendedor[]>(() => {
    const rows = this.dataset.registros();
    const map = new Map<string, { ventas: number; margen: number; cantidad: number }>();
    for (const r of rows) {
      const v = r.vendedor?.trim();
      if (!v) continue;
      const prev = map.get(v) ?? { ventas: 0, margen: 0, cantidad: 0 };
      prev.ventas += r.ventaTotalBruta;
      prev.margen += r.margen;
      prev.cantidad += 1;
      map.set(v, prev);
    }
    const arr = Array.from(map.entries()).map(([nombre, { ventas, margen, cantidad }]) => ({
      nombre,
      iniciales: iniciales(nombre),
      color: colorPorNombre(nombre),
      ventas,
      margen,
      margenPct: ventas > 0 ? (margen / ventas) * 100 : 0,
      cantidad,
      pctSobreMax: 0,
    }));
    arr.sort((a, b) => b.ventas - a.ventas);
    const max = arr[0]?.ventas ?? 1;
    arr.forEach((v) => (v.pctSobreMax = max > 0 ? (v.ventas / max) * 100 : 0));
    return arr;
  });

  tendenciaMensual = computed(() => {
    const rows = this.dataset.registros();
    const totales = Array(12).fill(0);
    for (const r of rows) {
      const m = r.mes;
      if (m >= 1 && m <= 12) totales[m - 1] += r.ventaTotalBruta;
    }
    return totales;
  });

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);
    effect(() => {
      // Suscripción explícita: canvases (viewChild signal) y datos (computed signals).
      // El effect vuelve a dispararse cuando los canvases entran al DOM tras *ngIf.
      const tend = this.tendenciaCanvas();
      const barras = this.barrasCanvas();
      const datosTendencia = this.tendenciaMensual();
      const datosBarras = this.desempeno();
      if (!tend || !barras) return;
      queueMicrotask(() => this.render(datosTendencia, datosBarras));
    });
  }

  ngOnDestroy(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  formatoCLP(n: number): string {
    return '$' + (Math.round(n) || 0).toLocaleString('es-CL');
  }

  private render(datosTendencia: number[], datosBarras: DesempenoVendedor[]): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];

    const tendCanvas = this.tendenciaCanvas();
    if (tendCanvas) {
      const cfg: ChartConfiguration<'line'> = {
        type: 'line',
        data: {
          labels: MESES_LARGO,
          datasets: [
            {
              label: 'Ventas',
              data: datosTendencia,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              tension: 0.35,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: '#2563eb',
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
      this.charts.push(new Chart(tendCanvas.nativeElement, cfg));
    }

    const barrasCanvas = this.barrasCanvas();
    if (barrasCanvas) {
      const top = datosBarras.slice(0, 10);
      const cfg: ChartConfiguration<'bar'> = {
        type: 'bar',
        data: {
          labels: top.map((v) => v.nombre.split(' ')[0]),
          datasets: [
            {
              label: 'Ventas',
              data: top.map((v) => v.ventas),
              backgroundColor: top.map((v) => v.color),
              borderRadius: 4,
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
      this.charts.push(new Chart(barrasCanvas.nativeElement, cfg));
    }
  }
}
