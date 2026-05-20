import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatasetService } from '../../services/dataset.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';

const PAGE_SIZE = 30;
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface ResumenProducto {
  nombre: string;
  sku: string;
  cantidad: number;
  venta: number;
  margen: number;
  margenPct: number;
  porMes: number[];
  ventaPorMes: number[];
  cantidadMaxMes: number;
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
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Productos únicos</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ todosProductos().length | number }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Unidades vendidas {{ texto() ? '(filtradas)' : '' }}</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ totalesFiltrados().cantidad | number }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Facturación {{ texto() ? '(filtrada)' : '' }}</p>
            <p class="text-2xl font-bold text-emerald-600 mt-1">{{ formatoCLP(totalesFiltrados().venta) }}</p>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 p-4 mb-4">
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
          <p class="text-xs text-slate-500 mt-2" *ngIf="filtrados().length !== todosProductos().length">
            {{ filtrados().length | number }} productos coinciden con la búsqueda.
          </p>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th class="text-left px-4 py-3 font-semibold sticky left-0 bg-slate-50 min-w-[280px]">Producto</th>
                  <th class="text-right px-3 py-3 font-semibold whitespace-nowrap">Unidades</th>
                  <th class="text-right px-3 py-3 font-semibold whitespace-nowrap">Venta</th>
                  <th class="text-right px-3 py-3 font-semibold whitespace-nowrap">Margen</th>
                  <th class="text-center px-2 py-3 font-semibold whitespace-nowrap" *ngFor="let m of meses">{{ m }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr *ngFor="let p of paginaActual()" class="hover:bg-slate-50">
                  <td class="px-4 py-3 sticky left-0 bg-white hover:bg-slate-50 min-w-[280px]">
                    <p class="text-sm font-medium text-slate-900" [title]="p.nombre">{{ p.nombre }}</p>
                    <p class="text-xs text-slate-500" *ngIf="p.sku">SKU: {{ p.sku }}</p>
                  </td>
                  <td class="px-3 py-3 text-right text-sm font-semibold text-slate-900">{{ p.cantidad | number }}</td>
                  <td class="px-3 py-3 text-right text-sm font-semibold text-slate-900 whitespace-nowrap">{{ formatoCLP(p.venta) }}</td>
                  <td class="px-3 py-3 text-right whitespace-nowrap">
                    <div class="text-sm font-semibold" [class.text-emerald-600]="p.margen >= 0" [class.text-rose-600]="p.margen < 0">{{ formatoCLP(p.margen) }}</div>
                    <div class="text-xs text-slate-500">{{ p.margenPct | number:'1.1-1' }}%</div>
                  </td>
                  <td class="px-2 py-3 text-center" *ngFor="let qty of p.porMes; let i = index">
                    <div
                      class="inline-flex flex-col items-center justify-end h-10 w-12"
                      [title]="qty ? (qty | number) + ' uds · ' + formatoCLP(p.ventaPorMes[i]) : '0 uds'"
                    >
                      <div
                        class="w-6 rounded-sm transition-all"
                        [class.bg-brand-500]="qty > 0"
                        [class.bg-slate-100]="qty === 0"
                        [style.height.%]="alturaMes(qty, p.cantidadMaxMes)"
                      ></div>
                      <span class="text-[10px] text-slate-600 mt-0.5">{{ qty | number }}</span>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="paginaActual().length === 0">
                  <td colspan="16" class="text-center text-sm text-slate-400 py-12">
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

  listoParaCalcular = signal(false);
  texto = signal('');
  pagina = signal(0);

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);
  }

  todosProductos = computed<ResumenProducto[]>(() => {
    const map = new Map<string, { nombre: string; sku: string; cantidad: number; venta: number; margen: number; porMes: number[]; ventaPorMes: number[] }>();
    for (const r of this.dataset.registros()) {
      const nombre = r.producto?.trim();
      if (!nombre) continue;
      let prev = map.get(nombre);
      if (!prev) {
        prev = {
          nombre,
          sku: r.sku || '',
          cantidad: 0,
          venta: 0,
          margen: 0,
          porMes: Array(12).fill(0),
          ventaPorMes: Array(12).fill(0),
        };
        map.set(nombre, prev);
      }
      prev.cantidad += r.cantidad;
      prev.venta += r.ventaTotalBruta;
      prev.margen += r.margen;
      if (r.mes >= 1 && r.mes <= 12) {
        prev.porMes[r.mes - 1] += r.cantidad;
        prev.ventaPorMes[r.mes - 1] += r.ventaTotalBruta;
      }
    }
    const arr: ResumenProducto[] = [];
    for (const p of map.values()) {
      arr.push({
        ...p,
        margenPct: p.venta > 0 ? (p.margen / p.venta) * 100 : 0,
        cantidadMaxMes: Math.max(...p.porMes, 1),
      });
    }
    arr.sort((a, b) => b.cantidad - a.cantidad);
    return arr;
  });

  filtrados = computed<ResumenProducto[]>(() => {
    const t = this.texto().toLowerCase().trim();
    if (!t) return this.todosProductos();
    const terminos = t.split(/\s+/).filter(Boolean);
    return this.todosProductos().filter((p) => {
      const blob = (p.nombre + ' ' + p.sku).toLowerCase();
      return terminos.every((term) => blob.includes(term));
    });
  });

  totalesFiltrados = computed(() => {
    let cantidad = 0;
    let venta = 0;
    for (const p of this.filtrados()) {
      cantidad += p.cantidad;
      venta += p.venta;
    }
    return { cantidad, venta };
  });

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / PAGE_SIZE)));

  paginaActual = computed(() => {
    const inicio = this.pagina() * PAGE_SIZE;
    return this.filtrados().slice(inicio, inicio + PAGE_SIZE);
  });

  formatoCLP(n: number): string {
    return '$' + (Math.round(n) || 0).toLocaleString('es-CL');
  }

  alturaMes(valor: number, max: number): number {
    if (max <= 0) return 0;
    return Math.max(8, Math.round((valor / max) * 100));
  }
}
