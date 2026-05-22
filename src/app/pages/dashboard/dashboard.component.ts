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
import { Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { CategoriasService } from '../../services/categorias.service';
import { DatasetService } from '../../services/dataset.service';
import { MetasService } from '../../services/metas.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { ProgressBarComponent } from '../../shared/progress-bar/progress-bar.component';
import { colorPorNombre, iniciales } from '../../utils/colores';

Chart.register(...registerables);

const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const CATEGORIAS = ['TERCEROS', 'HOLDING', 'TRABAJADORES'] as const;
type Categoria = typeof CATEGORIAS[number];

const COLOR_CATEGORIA: Record<Categoria, string> = {
  TERCEROS: '#2563eb',
  HOLDING: '#10b981',
  TRABAJADORES: '#f59e0b',
};

interface MetricasCategoria {
  ventasBrutas: number;
  ventasNetas: number;
  margen: number;
  margenPct: number;
  meta: number;
  cumplimiento: number;
  proyectado: number;
}

interface FilaVendedor {
  nombre: string;
  iniciales: string;
  color: string;
  ventasBrutas: number;
  ventasNetas: number;
  margen: number;
  margenPct: number;
  meta: number;
  cumplimiento: number;
  proyectado: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AvatarComponent, ProgressBarComponent, EmptyStateComponent],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p class="text-sm text-slate-500 mt-1">Resumen del mes por categoría de cliente</p>
      </div>

      <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
        <button
          (click)="mesAnterior()"
          [disabled]="!puedeAnterior()"
          class="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Mes anterior"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
          </svg>
        </button>
        <span class="px-3 text-sm font-semibold text-slate-900 min-w-[140px] text-center">
          {{ etiquetaMes() }}
        </span>
        <button
          (click)="mesSiguiente()"
          [disabled]="!puedeSiguiente()"
          class="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Mes siguiente"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
          </svg>
        </button>
      </div>
    </div>

    <ng-container *ngIf="dataset.cargando() || !listoParaCalcular(); else contenido">
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-12 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <span class="inline-block w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
        <span>Cargando dashboard...</span>
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
        <div class="space-y-3 mb-6">
          <div *ngFor="let cat of categorias" class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" [style.backgroundColor]="colorCategoria(cat)"></span>
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-600">{{ cat }}</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2" *ngIf="metricasPorCategoria()[cat] as m">
                <div class="bg-white rounded-lg border border-slate-100 p-3">
                  <p class="text-[10px] uppercase text-slate-500 font-medium tracking-wide">Ventas Brutas</p>
                  <p class="text-sm font-bold text-slate-900 mt-1">{{ formatoCLP(m.ventasBrutas) }}</p>
                </div>
                <div class="bg-white rounded-lg border border-slate-100 p-3">
                  <p class="text-[10px] uppercase text-slate-500 font-medium tracking-wide">Ventas Netas</p>
                  <p class="text-sm font-bold text-emerald-600 mt-1">{{ formatoCLP(m.ventasNetas) }}</p>
                </div>
                <div class="bg-white rounded-lg border border-slate-100 p-3">
                  <p class="text-[10px] uppercase text-slate-500 font-medium tracking-wide">Margen $</p>
                  <p class="text-sm font-bold text-emerald-600 mt-1">{{ formatoCLP(m.margen) }}</p>
                </div>
                <div class="bg-white rounded-lg border border-slate-100 p-3">
                  <p class="text-[10px] uppercase text-slate-500 font-medium tracking-wide">Margen %</p>
                  <p class="text-sm font-bold text-violet-600 mt-1">{{ m.margenPct | number:'1.1-1' }}%</p>
                </div>
                <div class="bg-white rounded-lg border border-slate-100 p-3">
                  <p class="text-[10px] uppercase text-slate-500 font-medium tracking-wide">Meta</p>
                  <p class="text-sm font-bold text-slate-900 mt-1">{{ formatoCLP(m.meta) }}</p>
                </div>
                <div class="bg-white rounded-lg border border-slate-100 p-3">
                  <p class="text-[10px] uppercase text-slate-500 font-medium tracking-wide">Cumplimiento</p>
                  <p class="text-sm font-bold mt-1" [class]="colorTextoPct(m.cumplimiento)">
                    {{ m.meta > 0 ? (m.cumplimiento | number:'1.1-1') + '%' : '—' }}
                  </p>
                  <div class="mt-1.5" *ngIf="m.meta > 0">
                    <app-progress-bar [valor]="m.cumplimiento" [alto]="4"></app-progress-bar>
                  </div>
                </div>
                <div class="bg-white rounded-lg border border-slate-100 p-3">
                  <p class="text-[10px] uppercase text-slate-500 font-medium tracking-wide">Proyectado</p>
                  <p class="text-sm font-bold mt-1" [class]="colorTextoPct(m.proyectado)">
                    {{ m.meta > 0 ? (m.proyectado | number:'1.1-1') + '%' : '—' }}
                  </p>
                </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 mb-6">
          <h3 class="text-base font-semibold text-slate-900 mb-4">Ventas Diarias del Mes por Categoría</h3>
          <div class="h-72"><canvas #diarioCanvas></canvas></div>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
          <div class="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-base font-semibold text-slate-900">Desempeño por Vendedor</h3>
            <span class="text-xs italic text-slate-400">Haz clic en un vendedor para ver detalles</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th class="text-left px-5 py-3 font-semibold">Vendedor</th>
                  <th class="text-right px-5 py-3 font-semibold">Ventas Brutas</th>
                  <th class="text-right px-5 py-3 font-semibold">Ventas Netas</th>
                  <th class="text-right px-5 py-3 font-semibold">Margen $</th>
                  <th class="text-right px-5 py-3 font-semibold">Margen %</th>
                  <th class="text-right px-5 py-3 font-semibold">Meta</th>
                  <th class="text-left px-5 py-3 font-semibold w-44">Cumplimiento</th>
                  <th class="text-right px-5 py-3 font-semibold">Proyectado</th>
                  <th class="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr *ngIf="filasVendedores().length === 0">
                  <td colspan="9" class="px-5 py-8 text-center text-sm text-slate-500">
                    No hay ventas para este mes.
                  </td>
                </tr>
                <tr *ngFor="let v of filasVendedores()" class="hover:bg-slate-50 cursor-pointer" (click)="abrirVendedor(v)">
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-3">
                      <app-avatar [iniciales]="v.iniciales" [color]="v.color"></app-avatar>
                      <p class="text-sm font-medium text-slate-900">{{ v.nombre }}</p>
                    </div>
                  </td>
                  <td class="px-5 py-3 text-right text-sm font-semibold text-slate-900">{{ formatoCLP(v.ventasBrutas) }}</td>
                  <td class="px-5 py-3 text-right text-sm font-semibold text-emerald-600">{{ formatoCLP(v.ventasNetas) }}</td>
                  <td class="px-5 py-3 text-right text-sm font-semibold text-emerald-600">{{ formatoCLP(v.margen) }}</td>
                  <td class="px-5 py-3 text-right text-sm font-semibold text-violet-600">{{ v.margenPct | number:'1.1-1' }}%</td>
                  <td class="px-5 py-3 text-right text-sm text-slate-700">{{ v.meta > 0 ? formatoCLP(v.meta) : '—' }}</td>
                  <td class="px-5 py-3">
                    <div *ngIf="v.meta > 0; else sinMeta" class="flex items-center gap-2">
                      <div class="flex-1">
                        <app-progress-bar [valor]="v.cumplimiento" [alto]="6"></app-progress-bar>
                      </div>
                      <span class="text-xs font-semibold w-14 text-right" [class]="colorTextoPct(v.cumplimiento)">
                        {{ v.cumplimiento | number:'1.1-1' }}%
                      </span>
                    </div>
                    <ng-template #sinMeta>
                      <span class="text-xs text-slate-400">Sin meta</span>
                    </ng-template>
                  </td>
                  <td class="px-5 py-3 text-right text-sm font-semibold" [class]="colorTextoPct(v.proyectado)">
                    {{ v.meta > 0 ? (v.proyectado | number:'1.1-1') + '%' : '—' }}
                  </td>
                  <td class="px-3 py-3 text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
                    </svg>
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
export class DashboardComponent implements OnInit, OnDestroy {
  diarioCanvas = viewChild<ElementRef<HTMLCanvasElement>>('diarioCanvas');

  dataset = inject(DatasetService);
  metasService = inject(MetasService);
  categoriasService = inject(CategoriasService);
  private router = inject(Router);

  listoParaCalcular = signal(false);
  mesSeleccionado = signal<number>(this.mesInicial());

  categorias = CATEGORIAS;

  private diarioChart?: Chart;

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);

    effect(() => {
      const anio = this.dataset.anioActivo();
      if (anio != null && this.metasService.anioCargado() !== anio) {
        this.metasService.cargarAnio(anio);
      }
    });

    effect(() => {
      const anio = this.dataset.anioActivo();
      const hoy = new Date();
      const mesActual = hoy.getMonth() + 1;
      if (anio === hoy.getFullYear()) {
        this.mesSeleccionado.set(mesActual);
      } else if (anio != null) {
        this.mesSeleccionado.set(12);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const canvas = this.diarioCanvas();
      const datos = this.seriesDiarias();
      if (!canvas) return;
      queueMicrotask(() => this.renderDiario(canvas, datos));
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
  }

  ngOnDestroy(): void {
    this.diarioChart?.destroy();
  }

  private mesInicial(): number {
    return new Date().getMonth() + 1;
  }

  etiquetaMes(): string {
    const anio = this.dataset.anioActivo();
    const m = this.mesSeleccionado();
    return MESES_LARGO[m - 1] + (anio ? ' ' + anio : '');
  }

  puedeAnterior(): boolean {
    return this.mesSeleccionado() > 1;
  }

  puedeSiguiente(): boolean {
    return this.mesSeleccionado() < 12;
  }

  mesAnterior(): void {
    if (this.puedeAnterior()) this.mesSeleccionado.update((v) => v - 1);
  }

  mesSiguiente(): void {
    if (this.puedeSiguiente()) this.mesSeleccionado.update((v) => v + 1);
  }

  abrirVendedor(v: FilaVendedor): void {
    this.router.navigate(['/equipo'], {
      queryParams: { vendedor: v.nombre, mes: this.mesSeleccionado() },
    });
  }

  colorCategoria(c: Categoria): string {
    return COLOR_CATEGORIA[c];
  }

  formatoCLP(n: number): string {
    return '$' + (Math.round(n) || 0).toLocaleString('es-CL');
  }

  colorTextoPct(pct: number): string {
    if (pct >= 100) return 'text-emerald-600';
    if (pct >= 75) return 'text-sky-600';
    if (pct >= 50) return 'text-amber-600';
    return 'text-rose-600';
  }

  private registrosDelMes = computed(() => {
    const mes = this.mesSeleccionado();
    return this.dataset.registros().filter((r) => r.mes === mes);
  });

  private factorProyeccion = computed(() => {
    const anio = this.dataset.anioActivo();
    const mes = this.mesSeleccionado();
    const hoy = new Date();
    const anioHoy = hoy.getFullYear();
    const mesHoy = hoy.getMonth() + 1;
    if (anio == null) return 1;
    if (anio < anioHoy || (anio === anioHoy && mes < mesHoy)) return 1; // mes cerrado
    if (anio > anioHoy || (anio === anioHoy && mes > mesHoy)) return 0; // mes futuro
    const diasMes = new Date(anio, mes, 0).getDate();
    const diaHoy = Math.max(1, hoy.getDate());
    return diasMes / diaHoy;
  });

  metricasPorCategoria = computed<Record<Categoria, MetricasCategoria>>(() => {
    const rows = this.registrosDelMes();
    const mapa = this.categoriasService.mapaPorRut();
    const metas = this.metasService.metas();
    const mes = this.mesSeleccionado();
    const anio = this.dataset.anioActivo();
    const factor = this.factorProyeccion();

    const init = (): MetricasCategoria => ({
      ventasBrutas: 0, ventasNetas: 0, margen: 0, margenPct: 0,
      meta: 0, cumplimiento: 0, proyectado: 0,
    });
    const out: Record<Categoria, MetricasCategoria> = {
      TERCEROS: init(), HOLDING: init(), TRABAJADORES: init(),
    };

    for (const r of rows) {
      const rut = (r.clienteRut ?? '').trim().toUpperCase().replace(/\./g, '');
      const cat = mapa.get(rut)?.categoria?.toUpperCase();
      if (cat && (CATEGORIAS as readonly string[]).includes(cat)) {
        const c = cat as Categoria;
        out[c].ventasBrutas += r.ventaTotalBruta;
        out[c].ventasNetas += r.ventaTotalNeta;
        out[c].margen += r.margen;
      }
    }

    for (const m of metas) {
      if (m.anio !== anio || m.mes !== mes) continue;
      const cat = (m.categoria ?? '').toUpperCase();
      if ((CATEGORIAS as readonly string[]).includes(cat)) {
        out[cat as Categoria].meta += m.metaClp;
      }
    }

    for (const c of CATEGORIAS) {
      const m = out[c];
      m.margenPct = m.ventasBrutas > 0 ? (m.margen / m.ventasBrutas) * 100 : 0;
      m.cumplimiento = m.meta > 0 ? (m.ventasBrutas / m.meta) * 100 : 0;
      m.proyectado = m.meta > 0 ? (m.ventasBrutas * factor / m.meta) * 100 : 0;
    }

    return out;
  });

  seriesDiarias = computed<{ labels: number[]; datasets: { categoria: Categoria; data: number[] }[] }>(() => {
    const anio = this.dataset.anioActivo() ?? new Date().getFullYear();
    const mes = this.mesSeleccionado();
    const diasMes = new Date(anio, mes, 0).getDate();
    const labels = Array.from({ length: diasMes }, (_, i) => i + 1);
    const mapa = this.categoriasService.mapaPorRut();

    const por: Record<Categoria, number[]> = {
      TERCEROS: Array(diasMes).fill(0),
      HOLDING: Array(diasMes).fill(0),
      TRABAJADORES: Array(diasMes).fill(0),
    };

    for (const r of this.registrosDelMes()) {
      const rut = (r.clienteRut ?? '').trim().toUpperCase().replace(/\./g, '');
      const cat = mapa.get(rut)?.categoria?.toUpperCase();
      if (!cat || !(CATEGORIAS as readonly string[]).includes(cat)) continue;
      const dia = r.dia;
      if (dia >= 1 && dia <= diasMes) {
        por[cat as Categoria][dia - 1] += r.ventaTotalBruta;
      }
    }

    return {
      labels,
      datasets: CATEGORIAS.map((c) => ({ categoria: c, data: por[c] })),
    };
  });

  filasVendedores = computed<FilaVendedor[]>(() => {
    const rows = this.registrosDelMes();
    const metas = this.metasService.metas();
    const mes = this.mesSeleccionado();
    const anio = this.dataset.anioActivo();
    const factor = this.factorProyeccion();

    const acum = new Map<string, { ventasBrutas: number; ventasNetas: number; margen: number; meta: number }>();
    const display = new Map<string, string>(); // key normalizada → nombre original
    const norm = (s: string) => s.trim().toUpperCase();

    const obtener = (nombre: string) => {
      const key = norm(nombre);
      if (!display.has(key)) display.set(key, nombre.trim());
      let prev = acum.get(key);
      if (!prev) {
        prev = { ventasBrutas: 0, ventasNetas: 0, margen: 0, meta: 0 };
        acum.set(key, prev);
      }
      return prev;
    };

    for (const r of rows) {
      if (!r.vendedor) continue;
      const a = obtener(r.vendedor);
      a.ventasBrutas += r.ventaTotalBruta;
      a.ventasNetas += r.ventaTotalNeta;
      a.margen += r.margen;
    }

    for (const m of metas) {
      if (m.anio !== anio || m.mes !== mes || !m.vendedor) continue;
      obtener(m.vendedor).meta += m.metaClp;
    }

    const filas: FilaVendedor[] = [];
    for (const [key, a] of acum) {
      const nombre = display.get(key) ?? key;
      filas.push({
        nombre,
        iniciales: iniciales(nombre),
        color: colorPorNombre(nombre),
        ventasBrutas: a.ventasBrutas,
        ventasNetas: a.ventasNetas,
        margen: a.margen,
        margenPct: a.ventasBrutas > 0 ? (a.margen / a.ventasBrutas) * 100 : 0,
        meta: a.meta,
        cumplimiento: a.meta > 0 ? (a.ventasBrutas / a.meta) * 100 : 0,
        proyectado: a.meta > 0 ? (a.ventasBrutas * factor / a.meta) * 100 : 0,
      });
    }
    filas.sort((x, y) => y.ventasBrutas - x.ventasBrutas);
    return filas;
  });

  private renderDiario(
    canvas: ElementRef<HTMLCanvasElement>,
    series: { labels: number[]; datasets: { categoria: Categoria; data: number[] }[] },
  ): void {
    this.diarioChart?.destroy();
    const cfg: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: series.labels.map(String),
        datasets: series.datasets.map((d) => ({
          label: d.categoria,
          data: d.data,
          borderColor: COLOR_CATEGORIA[d.categoria],
          backgroundColor: COLOR_CATEGORIA[d.categoria] + '22',
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: COLOR_CATEGORIA[d.categoria],
          pointBorderWidth: 2,
          fill: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: $${(ctx.parsed.y || 0).toLocaleString('es-CL')}`,
            },
          },
        },
        scales: {
          y: {
            ticks: {
              font: { size: 10 },
              callback: (v) => '$' + Number(v).toLocaleString('es-CL'),
            },
            grid: { color: '#f1f5f9' },
          },
          x: {
            title: { display: true, text: 'Día del Mes', font: { size: 11 } },
            ticks: { font: { size: 10 } },
            grid: { display: false },
          },
        },
      },
    };
    this.diarioChart = new Chart(canvas.nativeElement, cfg);
  }
}
