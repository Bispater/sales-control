import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RegistroVenta } from '../../models/dataset';
import { DatasetService } from '../../services/dataset.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { colorPorNombre, iniciales } from '../../utils/colores';

const PAGE_SIZE = 50;
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent],
  template: `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Registro de Ventas</h1>
      <p class="text-sm text-slate-500 mt-1">
        Detalle de transacciones {{ dataset.anioActivo() ? '· Año ' + dataset.anioActivo() : '' }}
      </p>
    </div>

    <ng-container *ngIf="dataset.cargando() || !listoParaCalcular(); else listo">
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-12 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <span class="inline-block w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
        <span>Cargando ventas...</span>
      </div>
    </ng-container>

    <ng-template #listo>
      <ng-container *ngIf="dataset.registros().length === 0; else ok">
        <app-empty-state
          titulo="Sin datos cargados"
          descripcion="Sube un CSV con tus ventas en la sección Datos para ver el detalle."
          enlace="/datos"
          enlaceLabel="Ir a Datos"
        ></app-empty-state>
      </ng-container>

      <ng-template #ok>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Ventas Totales</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ formatoCLP(kpis().total) }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Transacciones</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ kpis().transacciones | number }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Líneas (filtradas)</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ filtradas().length | number }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Promedio por Doc</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ formatoCLP(kpis().promedio) }}</p>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 p-4 mb-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="relative md:col-span-2">
              <span class="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
              </span>
              <input
                [ngModel]="texto()"
                (ngModelChange)="texto.set($event); pagina.set(0)"
                type="text"
                placeholder="Buscar por cliente, producto, RUT, SKU, vendedor..."
                class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <select
              [ngModel]="vendedorFiltro()"
              (ngModelChange)="vendedorFiltro.set($event); pagina.set(0)"
              class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="">Todos los vendedores</option>
              <option *ngFor="let v of vendedoresOpciones()" [value]="v">{{ v }}</option>
            </select>
            <select
              [ngModel]="sucursalFiltro()"
              (ngModelChange)="sucursalFiltro.set($event); pagina.set(0)"
              class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="">Todas las sucursales</option>
              <option *ngFor="let s of sucursalesOpciones()" [value]="s">{{ s }}</option>
            </select>
            <select
              [ngModel]="mesFiltro()"
              (ngModelChange)="mesFiltro.set(+$event); pagina.set(0)"
              class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option [value]="0">Todos los meses</option>
              <option *ngFor="let m of meses; let i = index" [value]="i + 1">{{ m }}</option>
            </select>
            <select
              [ngModel]="tipoMovFiltro()"
              (ngModelChange)="tipoMovFiltro.set($event); pagina.set(0)"
              class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="">Todos los tipos</option>
              <option *ngFor="let t of tiposMovOpciones()" [value]="t">{{ t }}</option>
            </select>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-base font-semibold text-slate-900">
              Resultados ({{ filtradas().length | number }})
            </h3>
            <div class="text-xs text-slate-500" *ngIf="totalPaginas() > 1">
              Página {{ pagina() + 1 }} de {{ totalPaginas() }}
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th class="text-left px-4 py-3 font-semibold">Fecha</th>
                  <th class="text-left px-4 py-3 font-semibold">Documento</th>
                  <th class="text-left px-4 py-3 font-semibold">Cliente</th>
                  <th class="text-left px-4 py-3 font-semibold">Producto / SKU</th>
                  <th class="text-left px-4 py-3 font-semibold">Vendedor</th>
                  <th class="text-left px-4 py-3 font-semibold">Sucursal</th>
                  <th class="text-right px-4 py-3 font-semibold">Cant.</th>
                  <th class="text-right px-4 py-3 font-semibold">Total Bruto</th>
                  <th class="text-right px-4 py-3 font-semibold">Margen</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr *ngFor="let v of pagina_actual()" class="hover:bg-slate-50">
                  <td class="px-4 py-2 text-slate-700 whitespace-nowrap">{{ v.fechaHoraVenta || v.fechaEmision }}</td>
                  <td class="px-4 py-2 text-slate-700 whitespace-nowrap">
                    <p class="font-medium">{{ v.numeroDocumento }}</p>
                    <p class="text-xs text-slate-500">{{ v.tipoDocumento }}</p>
                  </td>
                  <td class="px-4 py-2">
                    <p class="font-medium text-slate-900 truncate max-w-[20ch]" [title]="v.nombreCliente">{{ v.nombreCliente }}</p>
                    <p class="text-xs text-slate-500">{{ v.clienteRut }}</p>
                  </td>
                  <td class="px-4 py-2">
                    <p class="text-slate-700 truncate max-w-[28ch]" [title]="v.producto">{{ v.producto }}</p>
                    <p class="text-xs text-slate-500">{{ v.sku }}</p>
                  </td>
                  <td class="px-4 py-2">
                    <div class="flex items-center gap-2">
                      <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-semibold"
                            [style.backgroundColor]="color(v.vendedor)">
                        {{ inic(v.vendedor) }}
                      </span>
                      <span class="text-slate-700 truncate max-w-[14ch]" [title]="v.vendedor">{{ v.vendedor }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-2 text-slate-700 truncate max-w-[18ch]" [title]="v.sucursal">{{ v.sucursal }}</td>
                  <td class="px-4 py-2 text-right text-slate-700">{{ v.cantidad | number }}</td>
                  <td class="px-4 py-2 text-right font-semibold text-slate-900 whitespace-nowrap">{{ formatoCLP(v.ventaTotalBruta) }}</td>
                  <td class="px-4 py-2 text-right whitespace-nowrap">
                    <span class="font-semibold text-emerald-600">{{ formatoCLP(v.margen) }}</span>
                    <span class="block text-xs text-slate-500">{{ v.pctMargen | number:'1.1-1' }}%</span>
                  </td>
                </tr>
                <tr *ngIf="pagina_actual().length === 0">
                  <td colspan="9" class="text-center text-slate-400 text-sm py-8">No se encontraron ventas con los filtros aplicados.</td>
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
              {{ pagina() * pageSize + 1 | number }} - {{ Math.min((pagina() + 1) * pageSize, filtradas().length) | number }}
              de {{ filtradas().length | number }}
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
export class VentasComponent {
  dataset = inject(DatasetService);
  meses = MESES;
  pageSize = PAGE_SIZE;
  Math = Math;

  listoParaCalcular = signal(false);

  texto = signal('');
  vendedorFiltro = signal('');
  sucursalFiltro = signal('');
  mesFiltro = signal(0);
  tipoMovFiltro = signal('');
  pagina = signal(0);

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);
  }

  filtradas = computed(() => {
    const rows = this.dataset.registros();
    const t = this.texto().toLowerCase().trim();
    const vend = this.vendedorFiltro();
    const suc = this.sucursalFiltro();
    const mes = this.mesFiltro();
    const tipo = this.tipoMovFiltro();
    return rows.filter((r) => {
      if (vend && r.vendedor !== vend) return false;
      if (suc && r.sucursal !== suc) return false;
      if (mes && r.mes !== mes) return false;
      if (tipo && r.tipoMovimiento !== tipo) return false;
      if (t) {
        const hay =
          r.nombreCliente?.toLowerCase().includes(t) ||
          r.clienteRut?.toLowerCase().includes(t) ||
          r.producto?.toLowerCase().includes(t) ||
          r.sku?.toLowerCase().includes(t) ||
          r.vendedor?.toLowerCase().includes(t) ||
          r.numeroDocumento?.toLowerCase().includes(t);
        if (!hay) return false;
      }
      return true;
    });
  });

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / PAGE_SIZE)));

  pagina_actual = computed(() => {
    const inicio = this.pagina() * PAGE_SIZE;
    return this.filtradas().slice(inicio, inicio + PAGE_SIZE);
  });

  kpis = computed(() => {
    const f = this.filtradas();
    let total = 0;
    const docs = new Set<string>();
    for (const r of f) {
      total += r.ventaTotalBruta;
      if (r.numeroDocumento) docs.add(r.numeroDocumento + '|' + r.sucursal);
    }
    return {
      total,
      transacciones: docs.size,
      promedio: docs.size > 0 ? total / docs.size : 0,
    };
  });

  vendedoresOpciones = computed(() => this.unique('vendedor').sort());
  sucursalesOpciones = computed(() => this.unique('sucursal').sort());
  tiposMovOpciones = computed(() => this.unique('tipoMovimiento').sort());

  private unique(campo: keyof RegistroVenta): string[] {
    const s = new Set<string>();
    for (const r of this.dataset.registros()) {
      const v = r[campo];
      if (typeof v === 'string' && v) s.add(v);
    }
    return Array.from(s);
  }

  formatoCLP(n: number): string {
    return '$' + (Math.round(n) || 0).toLocaleString('es-CL');
  }
  color(n: string): string {
    return colorPorNombre(n);
  }
  inic(n: string): string {
    return iniciales(n);
  }
}
