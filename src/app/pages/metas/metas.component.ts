import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoriasService } from '../../services/categorias.service';
import { DatasetService } from '../../services/dataset.service';
import { MetasService } from '../../services/metas.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { colorPorNombre, iniciales } from '../../utils/colores';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface CeldaMes {
  meta: number;
  vendido: number;
  pct: number; // 0..∞ (puede pasar 100%)
}

interface FilaVendedor {
  nombre: string;
  iniciales: string;
  color: string;
  categoria: string;
  meses: CeldaMes[];
  metaAnual: number;
  vendidoAnual: number;
  pctAnual: number;
  // Desglose por categoría de cliente sobre el año
  porCategoriaCliente: Record<string, number>;
}

@Component({
  selector: 'app-metas',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent],
  template: `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Metas</h1>
        <p class="text-sm text-slate-500 mt-1">
          Cumplimiento mensual por vendedor {{ dataset.anioActivo() ? '· Año ' + dataset.anioActivo() : '' }}
        </p>
      </div>
    </div>

    <ng-container *ngIf="dataset.cargando() || metasService.cargando() || !listoParaCalcular(); else listo">
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-12 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <span class="inline-block w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
        <span>Cargando metas...</span>
      </div>
    </ng-container>

    <ng-template #listo>
      <ng-container *ngIf="filas().length === 0; else ok">
        <app-empty-state
          titulo="Sin metas cargadas"
          [descripcion]="
            metasService.metas().length === 0
              ? 'Sube el CSV de metas en la sección Datos para empezar a comparar contra las ventas.'
              : 'No hay vendedores con metas ni ventas en el año seleccionado.'
          "
          enlace="/datos"
          enlaceLabel="Ir a Datos"
        ></app-empty-state>
      </ng-container>

      <ng-template #ok>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Meta anual</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ formatoCLP(totales().meta) }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Vendido</p>
            <p class="text-2xl font-bold text-emerald-600 mt-1">{{ formatoCLP(totales().vendido) }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Cumplimiento</p>
            <p class="text-2xl font-bold mt-1" [class]="colorTextoPct(totales().pct)">
              {{ totales().pct | number:'1.0-0' }}%
            </p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Vendedores con meta</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ vendedoresConMeta() | number }}</p>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
            <h2 class="text-base font-semibold text-slate-900">Matriz de cumplimiento</h2>
            <div class="flex items-center gap-2 text-xs">
              <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-emerald-200"></span>≥100%</span>
              <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-amber-200"></span>80–99%</span>
              <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-rose-200"></span>&lt;80%</span>
              <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-slate-100"></span>sin meta</span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th class="text-left px-4 py-3 font-semibold sticky left-0 bg-slate-50 min-w-[200px]">Vendedor</th>
                  <th class="text-left px-3 py-3 font-semibold whitespace-nowrap">Categoría</th>
                  <th class="text-center px-2 py-3 font-semibold whitespace-nowrap" *ngFor="let m of meses; let i = index">{{ m }}</th>
                  <th class="text-right px-3 py-3 font-semibold whitespace-nowrap">Año</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  *ngFor="let f of filas()"
                  class="hover:bg-slate-50 cursor-pointer"
                  (click)="seleccionar(f)"
                  [class.bg-brand-50]="seleccionado()?.nombre === f.nombre"
                >
                  <td class="px-4 py-3 sticky left-0 bg-white hover:bg-slate-50" [class.bg-brand-50]="seleccionado()?.nombre === f.nombre">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0" [style.backgroundColor]="f.color">
                        {{ f.iniciales }}
                      </div>
                      <p class="text-sm font-medium text-slate-900 whitespace-nowrap">{{ f.nombre }}</p>
                    </div>
                  </td>
                  <td class="px-3 py-3 text-xs text-slate-600">{{ f.categoria || '—' }}</td>
                  <td class="px-2 py-3 text-center" *ngFor="let c of f.meses; let i = index">
                    <div
                      class="inline-flex flex-col items-center justify-center min-w-[50px] py-1 rounded"
                      [class]="claseCelda(c)"
                      [title]="tooltip(f.nombre, i, c)"
                    >
                      <span class="text-xs font-semibold">{{ c.meta > 0 ? (c.pct | number:'1.0-0') + '%' : '—' }}</span>
                      <span class="text-[10px] opacity-75" *ngIf="c.meta > 0">{{ compactCLP(c.vendido) }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-3 text-right whitespace-nowrap">
                    <p class="text-sm font-semibold" [class]="colorTextoPct(f.pctAnual)">
                      {{ f.metaAnual > 0 ? (f.pctAnual | number:'1.0-0') + '%' : '—' }}
                    </p>
                    <p class="text-xs text-slate-500">{{ compactCLP(f.vendidoAnual) }} / {{ compactCLP(f.metaAnual) }}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-template>
    </ng-template>

    <!-- Drill-down -->
    <div
      *ngIf="seleccionado() as s"
      class="fixed inset-0 bg-slate-900/40 flex items-start justify-center p-6 z-50 overflow-y-auto"
      (click)="cerrar()"
    >
      <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full mt-12" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between p-5 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg text-white flex items-center justify-center font-bold" [style.backgroundColor]="s.color">
              {{ s.iniciales }}
            </div>
            <div>
              <p class="font-bold text-slate-900">{{ s.nombre }}</p>
              <p class="text-xs text-slate-500">Categoría asignada: {{ s.categoria || '—' }}</p>
            </div>
          </div>
          <button (click)="cerrar()" class="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="p-5 space-y-5">
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-slate-50 rounded-lg p-3 text-center">
              <p class="text-xs text-slate-500">Meta del año</p>
              <p class="text-base font-bold text-slate-900 mt-1">{{ formatoCLP(s.metaAnual) }}</p>
            </div>
            <div class="bg-emerald-50 rounded-lg p-3 text-center">
              <p class="text-xs text-slate-500">Vendido</p>
              <p class="text-base font-bold text-emerald-700 mt-1">{{ formatoCLP(s.vendidoAnual) }}</p>
            </div>
            <div class="rounded-lg p-3 text-center" [class.bg-emerald-50]="s.pctAnual >= 100" [class.bg-amber-50]="s.pctAnual >= 80 && s.pctAnual < 100" [class.bg-rose-50]="s.metaAnual > 0 && s.pctAnual < 80" [class.bg-slate-50]="s.metaAnual === 0">
              <p class="text-xs text-slate-500">Cumplimiento</p>
              <p class="text-base font-bold mt-1" [class]="colorTextoPct(s.pctAnual)">
                {{ s.metaAnual > 0 ? (s.pctAnual | number:'1.0-0') + '%' : '—' }}
              </p>
            </div>
          </div>

          <section *ngIf="objectKeys(s.porCategoriaCliente).length > 0">
            <h4 class="text-sm font-semibold text-slate-900 mb-2">Desglose por categoría de cliente (año completo)</h4>
            <div class="space-y-2">
              <div *ngFor="let entry of porCategoriaOrdenado(s)" class="flex items-center gap-3">
                <div class="w-28 text-xs text-slate-700 truncate" [title]="entry.cat">
                  {{ entry.cat }}
                  <span *ngIf="entry.cat === s.categoria" class="text-emerald-600 font-semibold">·</span>
                </div>
                <div class="flex-1 h-3 bg-slate-100 rounded overflow-hidden">
                  <div class="h-full bg-brand-500" [style.width.%]="s.vendidoAnual > 0 ? (entry.monto / s.vendidoAnual) * 100 : 0"></div>
                </div>
                <div class="w-32 text-xs text-right text-slate-700 whitespace-nowrap">
                  {{ formatoCLP(entry.monto) }}
                  <span class="text-slate-400">({{ s.vendidoAnual > 0 ? (entry.monto / s.vendidoAnual * 100 | number:'1.0-0') : 0 }}%)</span>
                </div>
              </div>
            </div>
            <p class="text-xs text-slate-400 mt-3" *ngIf="hayDescuadre(s)">
              ⚠ Este vendedor también vendió a clientes fuera de su categoría asignada ({{ s.categoria }}).
            </p>
          </section>

          <section>
            <h4 class="text-sm font-semibold text-slate-900 mb-2">Detalle mensual</h4>
            <table class="w-full text-sm">
              <thead class="text-xs uppercase text-slate-500">
                <tr>
                  <th class="text-left py-2">Mes</th>
                  <th class="text-right py-2">Meta</th>
                  <th class="text-right py-2">Vendido</th>
                  <th class="text-right py-2">%</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr *ngFor="let m of s.meses; let i = index">
                  <td class="py-2">{{ meses[i] }}</td>
                  <td class="py-2 text-right text-slate-600">{{ m.meta > 0 ? formatoCLP(m.meta) : '—' }}</td>
                  <td class="py-2 text-right font-medium text-slate-900">{{ formatoCLP(m.vendido) }}</td>
                  <td class="py-2 text-right font-semibold" [class]="colorTextoPct(m.pct)">
                    {{ m.meta > 0 ? (m.pct | number:'1.0-0') + '%' : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class MetasComponent implements OnInit {
  dataset = inject(DatasetService);
  metasService = inject(MetasService);
  categoriasService = inject(CategoriasService);

  meses = MESES;
  objectKeys = Object.keys;

  listoParaCalcular = signal(false);
  seleccionado = signal<FilaVendedor | null>(null);

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);
    // Recargar metas cuando cambie el año activo
    effect(() => {
      const anio = this.dataset.anioActivo();
      if (anio != null && this.metasService.anioCargado() !== anio) {
        this.metasService.cargarAnio(anio);
      }
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

  filas = computed<FilaVendedor[]>(() => {
    const registros = this.dataset.registros();
    const metas = this.metasService.metas();
    const mapaCategoria = this.categoriasService.mapaPorRut();

    // Indexar metas por vendedor
    type AcumVendedor = {
      categoria: string;
      meses: { meta: number; vendido: number }[];
      porCategoriaCliente: Record<string, number>;
    };
    const acum = new Map<string, AcumVendedor>();

    const norm = (s: string) => s.trim().toUpperCase();
    const claveMap = new Map<string, string>(); // norm → display name

    const obtener = (display: string): AcumVendedor => {
      const key = norm(display);
      claveMap.set(key, display);
      let prev = acum.get(key);
      if (!prev) {
        prev = {
          categoria: '',
          meses: Array.from({ length: 12 }, () => ({ meta: 0, vendido: 0 })),
          porCategoriaCliente: {},
        };
        acum.set(key, prev);
      }
      return prev;
    };

    for (const m of metas) {
      if (!m.vendedor) continue;
      const a = obtener(m.vendedor);
      if (!a.categoria && m.categoria) a.categoria = m.categoria;
      const idx = m.mes - 1;
      if (idx >= 0 && idx < 12) a.meses[idx].meta = m.metaClp;
    }

    for (const r of registros) {
      if (!r.vendedor) continue;
      const a = obtener(r.vendedor);
      const idx = (r.mes ?? 0) - 1;
      if (idx >= 0 && idx < 12) a.meses[idx].vendido += r.ventaTotalBruta;
      const rut = (r.clienteRut ?? '').trim().toUpperCase().replace(/\./g, '');
      const catCliente = mapaCategoria.get(rut)?.categoria ?? 'SIN CATEGORÍA';
      a.porCategoriaCliente[catCliente] = (a.porCategoriaCliente[catCliente] ?? 0) + r.ventaTotalBruta;
    }

    const filas: FilaVendedor[] = [];
    for (const [key, a] of acum) {
      const display = claveMap.get(key) ?? key;
      const meses: CeldaMes[] = a.meses.map((c) => ({
        meta: c.meta,
        vendido: c.vendido,
        pct: c.meta > 0 ? (c.vendido / c.meta) * 100 : 0,
      }));
      const metaAnual = meses.reduce((s, c) => s + c.meta, 0);
      const vendidoAnual = meses.reduce((s, c) => s + c.vendido, 0);
      filas.push({
        nombre: display,
        iniciales: iniciales(display),
        color: colorPorNombre(display),
        categoria: a.categoria,
        meses,
        metaAnual,
        vendidoAnual,
        pctAnual: metaAnual > 0 ? (vendidoAnual / metaAnual) * 100 : 0,
        porCategoriaCliente: a.porCategoriaCliente,
      });
    }
    // Vendedores con meta primero (ordenados por % desc), luego sin meta por ventas desc.
    filas.sort((a, b) => {
      const aHas = a.metaAnual > 0 ? 1 : 0;
      const bHas = b.metaAnual > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (aHas) return b.pctAnual - a.pctAnual;
      return b.vendidoAnual - a.vendidoAnual;
    });
    return filas;
  });

  totales = computed(() => {
    let meta = 0;
    let vendido = 0;
    for (const f of this.filas()) {
      meta += f.metaAnual;
      vendido += f.vendidoAnual;
    }
    return { meta, vendido, pct: meta > 0 ? (vendido / meta) * 100 : 0 };
  });

  vendedoresConMeta = computed(() => this.filas().filter((f) => f.metaAnual > 0).length);

  seleccionar(f: FilaVendedor) {
    this.seleccionado.set(f);
  }

  cerrar() {
    this.seleccionado.set(null);
  }

  formatoCLP(n: number): string {
    return '$' + (Math.round(n) || 0).toLocaleString('es-CL');
  }

  compactCLP(n: number): string {
    if (!n) return '$0';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  claseCelda(c: CeldaMes): string {
    if (c.meta === 0) return 'bg-slate-100 text-slate-400';
    if (c.pct >= 100) return 'bg-emerald-100 text-emerald-700';
    if (c.pct >= 80) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  }

  colorTextoPct(pct: number): string {
    if (pct >= 100) return 'text-emerald-600';
    if (pct >= 80) return 'text-amber-600';
    if (pct > 0) return 'text-rose-600';
    return 'text-slate-400';
  }

  tooltip(nombre: string, mesIdx: number, c: CeldaMes): string {
    const meta = c.meta > 0 ? this.formatoCLP(c.meta) : 'sin meta';
    return `${nombre} · ${this.meses[mesIdx]} · Meta: ${meta} · Vendido: ${this.formatoCLP(c.vendido)}`;
  }

  porCategoriaOrdenado(f: FilaVendedor): { cat: string; monto: number }[] {
    return Object.entries(f.porCategoriaCliente)
      .map(([cat, monto]) => ({ cat, monto }))
      .sort((a, b) => b.monto - a.monto);
  }

  hayDescuadre(f: FilaVendedor): boolean {
    if (!f.categoria) return false;
    return Object.keys(f.porCategoriaCliente).some((c) => c !== f.categoria && f.porCategoriaCliente[c] > 0);
  }
}
