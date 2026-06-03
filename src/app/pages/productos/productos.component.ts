import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatasetService } from '../../services/dataset.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';

const PAGE_SIZE = 30;
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type Metrica = 'unidades' | 'ventas' | 'margen';
// clave de orden: 'acumulado' o índice de mes 0-11
type OrdenKey = 'acumulado' | number;

interface ResumenProducto {
  nombre: string;
  sku: string;
  marca: string;
  tipo: string;
  cantidad: number;
  venta: number;
  margen: number;
  margenPct: number;
  porMes: number[];
  ventaPorMes: number[];
  margenPorMes: number[];
}

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent],
  template: `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Productos</h1>
      <p class="text-sm text-slate-500 mt-1">
        Búsqueda y desglose mensual {{ dataset.anioActivo() ? '· Año ' + dataset.anioActivo() : '' }}
      </p>
    </div>

    <ng-container *ngIf="dataset.cargando() || !listoParaCalcular(); else listo">
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-12 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <span class="inline-block w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
        <span>Cargando productos...</span>
      </div>
    </ng-container>

    <ng-template #listo>
      <ng-container *ngIf="dataset.registros().length === 0; else ok">
        <app-empty-state
          titulo="Sin datos cargados"
          descripcion="Sube un CSV con tus ventas en la sección Datos para analizar tus productos."
          enlace="/datos"
          enlaceLabel="Ir a Datos"
        ></app-empty-state>
      </ng-container>

      <ng-template #ok>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Cantidad de SKU</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ cantidadSku() | number }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Producto más vendido en unidades</p>
            <p class="text-base font-bold text-slate-900 mt-1 truncate" [title]="topUnidades()?.nombre">{{ topUnidades()?.nombre || '—' }}</p>
            <p class="text-xs text-slate-500 mt-0.5">{{ (topUnidades()?.cantidad || 0) | number }} unidades</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Producto más vendido en plata</p>
            <p class="text-base font-bold text-slate-900 mt-1 truncate" [title]="topVenta()?.nombre">{{ topVenta()?.nombre || '—' }}</p>
            <p class="text-xs font-semibold text-emerald-600 mt-0.5">{{ formatoCLP(topVenta()?.venta || 0) }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Producto con mayor margen</p>
            <p class="text-base font-bold text-slate-900 mt-1 truncate" [title]="topMargen()?.nombre">{{ topMargen()?.nombre || '—' }}</p>
            <p class="text-xs font-semibold text-violet-600 mt-0.5">{{ formatoCLP(topMargen()?.margen || 0) }}</p>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 p-4 mb-4 space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-[1fr_200px_200px] gap-3">
            <div class="relative">
              <span class="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
              </span>
              <input
                [ngModel]="texto()"
                (ngModelChange)="texto.set($event); pagina.set(0)"
                type="text"
                placeholder="Buscar por nombre del producto o SKU (ej: ACEITE MARAVILLA, 12345)"
                class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <select
              [ngModel]="marcaFiltro()"
              (ngModelChange)="marcaFiltro.set($event); pagina.set(0)"
              class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Todas las marcas</option>
              <option *ngFor="let m of marcasOpciones()" [value]="m">{{ m }}</option>
            </select>
            <select
              [ngModel]="tipoFiltro()"
              (ngModelChange)="tipoFiltro.set($event); pagina.set(0)"
              class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Todas las categorías</option>
              <option *ngFor="let t of tiposOpciones()" [value]="t">{{ t }}</option>
            </select>
          </div>

          <!-- Tabs de métrica -->
          <div class="flex items-center gap-1 border-t border-slate-100 pt-3">
            <button *ngFor="let t of tabs"
              (click)="metrica.set(t.key)"
              class="text-sm px-3 py-1.5 rounded-lg font-medium transition"
              [class.bg-brand-600]="metrica() === t.key"
              [class.text-white]="metrica() === t.key"
              [class.text-slate-600]="metrica() !== t.key"
              [class.hover:bg-slate-100]="metrica() !== t.key"
            >{{ t.label }}</button>
            <p class="text-xs text-slate-400 ml-auto" *ngIf="filtrados().length !== todosProductos().length">
              {{ filtrados().length | number }} productos coinciden.
            </p>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th class="text-left px-4 py-3 font-semibold sticky left-0 bg-slate-50 min-w-[280px]">Producto</th>
                  <th class="px-3 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-slate-700"
                      (click)="ordenarPor('acumulado')">
                    <span class="inline-flex items-center gap-1 justify-end w-full">Acumulado {{ flecha('acumulado') }}</span>
                  </th>
                  <th *ngFor="let m of meses; let i = index"
                      class="px-2 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-slate-700"
                      (click)="ordenarPor(i)">
                    <span class="inline-flex items-center gap-0.5 justify-center w-full">{{ m }} {{ flecha(i) }}</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr *ngFor="let p of paginaActual()" class="hover:bg-slate-50">
                  <td class="px-4 py-3 sticky left-0 bg-white hover:bg-slate-50 min-w-[280px]">
                    <p class="text-sm font-medium text-slate-900" [title]="p.nombre">{{ p.nombre }}</p>
                    <p class="text-xs text-slate-500">
                      <span *ngIf="p.sku">SKU: {{ p.sku }}</span>
                      <span *ngIf="p.marca" class="ml-2">· {{ p.marca }}</span>
                      <span *ngIf="p.tipo" class="ml-2">· {{ p.tipo }}</span>
                    </p>
                  </td>
                  <td class="px-3 py-3 text-right text-sm font-bold whitespace-nowrap"
                      [class.text-emerald-600]="metrica() === 'ventas'"
                      [class.text-violet-600]="metrica() === 'margen'"
                      [class.text-slate-900]="metrica() === 'unidades'">
                    {{ celdaTotal(p) }}
                  </td>
                  <td *ngFor="let v of serieDe(p)" class="px-2 py-3 text-center text-sm whitespace-nowrap"
                      [class.text-slate-300]="v === 0"
                      [class.text-slate-700]="v !== 0">
                    {{ v === 0 ? '—' : celdaMes(v) }}
                  </td>
                </tr>
                <tr *ngIf="paginaActual().length === 0">
                  <td colspan="14" class="text-center text-sm text-slate-400 py-12">
                    No se encontraron productos con esa búsqueda.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div *ngIf="totalPaginas() > 1" class="flex items-center justify-between p-4 border-t border-slate-100">
            <button
              (click)="pagina.set(Math.max(0, pagina() - 1))"
              [disabled]="pagina() === 0"
              class="text-sm px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
            >Anterior</button>
            <span class="text-xs text-slate-500">
              Página {{ pagina() + 1 }} de {{ totalPaginas() }} · {{ filtrados().length | number }} productos
            </span>
            <button
              (click)="pagina.set(Math.min(totalPaginas() - 1, pagina() + 1))"
              [disabled]="pagina() >= totalPaginas() - 1"
              class="text-sm px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
            >Siguiente</button>
          </div>
        </div>
      </ng-template>
    </ng-template>
  `,
})
export class ProductosComponent {
  dataset = inject(DatasetService);
  meses = MESES;
  Math = Math;
  pageSize = PAGE_SIZE;

  tabs: { key: Metrica; label: string }[] = [
    { key: 'unidades', label: 'Unidades' },
    { key: 'ventas', label: 'Ventas brutas' },
    { key: 'margen', label: 'Margen en dinero' },
  ];

  listoParaCalcular = signal(false);
  texto = signal('');
  marcaFiltro = signal('');
  tipoFiltro = signal('');
  metrica = signal<Metrica>('unidades');
  ordenKey = signal<OrdenKey>('acumulado');
  ordenDesc = signal(true);
  pagina = signal(0);

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);
  }

  todosProductos = computed<ResumenProducto[]>(() => {
    const map = new Map<string, {
      nombre: string; sku: string;
      marcas: Map<string, number>; tipos: Map<string, number>;
      cantidad: number; venta: number; margen: number;
      porMes: number[]; ventaPorMes: number[]; margenPorMes: number[];
    }>();
    for (const r of this.dataset.registros()) {
      const nombre = r.producto?.trim();
      if (!nombre) continue;
      let prev = map.get(nombre);
      if (!prev) {
        prev = {
          nombre,
          sku: r.sku || '',
          marcas: new Map<string, number>(),
          tipos: new Map<string, number>(),
          cantidad: 0,
          venta: 0,
          margen: 0,
          porMes: Array(12).fill(0),
          ventaPorMes: Array(12).fill(0),
          margenPorMes: Array(12).fill(0),
        };
        map.set(nombre, prev);
      }
      prev.cantidad += r.cantidad;
      prev.venta += r.ventaTotalBruta;
      prev.margen += r.margen;
      const marca = (r.marca || '').trim();
      if (marca) prev.marcas.set(marca, (prev.marcas.get(marca) ?? 0) + 1);
      const tipo = (r.tipoProducto || '').trim();
      if (tipo) prev.tipos.set(tipo, (prev.tipos.get(tipo) ?? 0) + 1);
      if (r.mes >= 1 && r.mes <= 12) {
        prev.porMes[r.mes - 1] += r.cantidad;
        prev.ventaPorMes[r.mes - 1] += r.ventaTotalBruta;
        prev.margenPorMes[r.mes - 1] += r.margen;
      }
    }
    const dominante = (m: Map<string, number>): string => {
      let best = ''; let max = 0;
      m.forEach((v, k) => { if (v > max) { max = v; best = k; } });
      return best;
    };
    const arr: ResumenProducto[] = [];
    for (const p of map.values()) {
      arr.push({
        nombre: p.nombre,
        sku: p.sku,
        marca: dominante(p.marcas),
        tipo: dominante(p.tipos),
        cantidad: p.cantidad,
        venta: p.venta,
        margen: p.margen,
        margenPct: p.venta > 0 ? (p.margen / p.venta) * 100 : 0,
        porMes: p.porMes,
        ventaPorMes: p.ventaPorMes,
        margenPorMes: p.margenPorMes,
      });
    }
    return arr;
  });

  // ---------- Cards ----------
  cantidadSku = computed<number>(() => {
    const set = new Set<string>();
    for (const r of this.dataset.registros()) {
      const sku = (r.sku || '').trim();
      if (sku) set.add(sku.toUpperCase());
    }
    return set.size;
  });

  topUnidades = computed<ResumenProducto | null>(() =>
    this.maxPor((p) => p.cantidad));
  topVenta = computed<ResumenProducto | null>(() =>
    this.maxPor((p) => p.venta));
  topMargen = computed<ResumenProducto | null>(() =>
    this.maxPor((p) => p.margen));

  private maxPor(valor: (p: ResumenProducto) => number): ResumenProducto | null {
    let best: ResumenProducto | null = null;
    let max = -Infinity;
    for (const p of this.todosProductos()) {
      const v = valor(p);
      if (v > max) { max = v; best = p; }
    }
    return best;
  }

  // ---------- Filtros ----------
  marcasOpciones = computed<string[]>(() => {
    const set = new Set<string>();
    this.todosProductos().forEach((p) => { if (p.marca) set.add(p.marca); });
    return Array.from(set).sort();
  });

  tiposOpciones = computed<string[]>(() => {
    const set = new Set<string>();
    this.todosProductos().forEach((p) => { if (p.tipo) set.add(p.tipo); });
    return Array.from(set).sort();
  });

  filtrados = computed<ResumenProducto[]>(() => {
    const t = this.texto().toLowerCase().trim();
    const marca = this.marcaFiltro();
    const tipo = this.tipoFiltro();
    const terminos = t ? t.split(/\s+/).filter(Boolean) : [];
    return this.todosProductos().filter((p) => {
      if (marca && p.marca !== marca) return false;
      if (tipo && p.tipo !== tipo) return false;
      if (terminos.length) {
        const blob = (p.nombre + ' ' + p.sku + ' ' + p.marca + ' ' + p.tipo).toLowerCase();
        if (!terminos.every((term) => blob.includes(term))) return false;
      }
      return true;
    });
  });

  // ---------- Orden ----------
  ordenados = computed<ResumenProducto[]>(() => {
    const key = this.ordenKey();
    const desc = this.ordenDesc();
    const arr = [...this.filtrados()];
    const valor = (p: ResumenProducto): number =>
      key === 'acumulado' ? this.totalDe(p) : this.serieDe(p)[key] ?? 0;
    arr.sort((a, b) => (desc ? valor(b) - valor(a) : valor(a) - valor(b)));
    return arr;
  });

  ordenarPor(key: OrdenKey): void {
    if (this.ordenKey() === key) {
      this.ordenDesc.update((v) => !v);
    } else {
      this.ordenKey.set(key);
      this.ordenDesc.set(true);
    }
    this.pagina.set(0);
  }

  flecha(key: OrdenKey): string {
    if (this.ordenKey() !== key) return '↕';
    return this.ordenDesc() ? '↓' : '↑';
  }

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.ordenados().length / PAGE_SIZE)));

  paginaActual = computed(() => {
    const inicio = this.pagina() * PAGE_SIZE;
    return this.ordenados().slice(inicio, inicio + PAGE_SIZE);
  });

  // ---------- Helpers de métrica ----------
  serieDe(p: ResumenProducto): number[] {
    const m = this.metrica();
    return m === 'unidades' ? p.porMes : m === 'ventas' ? p.ventaPorMes : p.margenPorMes;
  }
  totalDe(p: ResumenProducto): number {
    const m = this.metrica();
    return m === 'unidades' ? p.cantidad : m === 'ventas' ? p.venta : p.margen;
  }
  celdaTotal(p: ResumenProducto): string {
    return this.metrica() === 'unidades' ? (p.cantidad || 0).toLocaleString('es-CL') : this.formatoCLP(this.totalDe(p));
  }
  celdaMes(v: number): string {
    return this.metrica() === 'unidades' ? v.toLocaleString('es-CL') : this.compactCLP(v);
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
}
