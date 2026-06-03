import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RegistroVenta } from '../../models/dataset';
import { CategoriasService } from '../../services/categorias.service';
import { DatasetService } from '../../services/dataset.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { colorPorNombre, iniciales } from '../../utils/colores';

const PAGE_SIZE = 50;
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Clases de badge por canal (categoría del cliente).
const CANAL_BADGE: Record<string, string> = {
  TERCEROS: 'bg-sky-100 text-sky-700',
  HOLDING: 'bg-emerald-100 text-emerald-700',
  TRABAJADORES: 'bg-amber-100 text-amber-700',
};

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Registro de Ventas</h1>
        <p class="text-sm text-slate-500 mt-1">
          Detalle de transacciones {{ dataset.anioActivo() ? '· Año ' + dataset.anioActivo() : '' }}
        </p>
      </div>

      <!-- Selector de mes estilo dashboard ("como los de base") -->
      <div class="flex items-center gap-2">
        <button
          (click)="toggleTodos()"
          class="text-xs px-2.5 py-1.5 rounded-md border transition"
          [class.bg-brand-50]="mesFiltro() === 0"
          [class.border-brand-300]="mesFiltro() === 0"
          [class.text-brand-700]="mesFiltro() === 0"
          [class.border-slate-200]="mesFiltro() !== 0"
          [class.text-slate-600]="mesFiltro() !== 0"
        >{{ mesFiltro() === 0 ? 'Viendo todos' : 'Ver todos' }}</button>
        <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
          <button (click)="mesAnterior()" [disabled]="!puedeAnterior()"
                  class="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Mes anterior">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
            </svg>
          </button>
          <span class="px-3 text-sm font-semibold text-slate-900 min-w-[140px] text-center">{{ etiquetaMes() }}</span>
          <button (click)="mesSiguiente()" [disabled]="!puedeSiguiente()"
                  class="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Mes siguiente">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
            </svg>
          </button>
        </div>
      </div>
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
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <!-- Ventas Totales Brutas -->
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-slate-500 font-medium">Ventas Totales Brutas</p>
              <p class="text-2xl font-bold text-slate-900 mt-1">{{ formatoCLP(kpis().bruto) }}</p>
            </div>
            <span class="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"/>
              </svg>
            </span>
          </div>

          <!-- Ventas Totales Netas -->
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-slate-500 font-medium">Ventas Totales Netas</p>
              <p class="text-2xl font-bold text-emerald-600 mt-1">{{ formatoCLP(kpis().neto) }}</p>
            </div>
            <span class="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185ZM9.75 9h.008v.008H9.75V9Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 4.5h.008v.008h-.008V13.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/>
              </svg>
            </span>
          </div>

          <!-- Margen $ + % juntos -->
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-slate-500 font-medium">Margen</p>
              <p class="text-2xl font-bold text-emerald-600 mt-1">{{ formatoCLP(kpis().margen) }}</p>
              <p class="text-xs font-semibold text-violet-600 mt-0.5">{{ kpis().margenPct | number:'1.1-1' }}%</p>
            </div>
            <span class="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/>
              </svg>
            </span>
          </div>

          <!-- Transacciones / Productos vendidos (líneas) -->
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-slate-500 font-medium">Transacciones / Productos</p>
              <p class="text-2xl font-bold text-slate-900 mt-1">
                {{ kpis().transacciones | number }}<span class="text-slate-300 font-normal"> / </span>{{ kpis().lineas | number }}
              </p>
              <p class="text-xs text-slate-500 mt-0.5">Facturas emitidas · Líneas vendidas</p>
            </div>
            <span class="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
              </svg>
            </span>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 p-4 mb-4 space-y-3">
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
              [ngModel]="canalFiltro()"
              (ngModelChange)="canalFiltro.set($event); pagina.set(0)"
              class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="">Todos los canales</option>
              <option *ngFor="let c of canalesOpciones()" [value]="c">{{ c }}</option>
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

          <!-- Filtro nuevo de calendario: rango de fechas -->
          <div class="flex flex-wrap items-end gap-3 pt-3 border-t border-slate-100">
            <div class="flex items-center gap-2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
              </svg>
              <span class="text-xs uppercase font-medium tracking-wide">Calendario</span>
            </div>
            <div>
              <label class="block text-[11px] text-slate-500 mb-1">Desde</label>
              <input type="date" [ngModel]="desde()" (ngModelChange)="desde.set($event); pagina.set(0)"
                     class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
            </div>
            <div>
              <label class="block text-[11px] text-slate-500 mb-1">Hasta</label>
              <input type="date" [ngModel]="hasta()" (ngModelChange)="hasta.set($event); pagina.set(0)"
                     class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
            </div>
            <button *ngIf="desde() || hasta()" (click)="limpiarRango()"
                    class="text-xs px-2.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              Limpiar fechas
            </button>
            <span *ngIf="rangoActivo()" class="text-xs text-amber-600 self-center">
              El rango de fechas tiene prioridad sobre el mes seleccionado.
            </span>
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
                  <th class="text-left px-4 py-3 font-semibold">Canal</th>
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
                  <td class="px-4 py-2">
                    <span *ngIf="canalDe(v) as c; else sinCanal"
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" [class]="canalBadge(c)">{{ c }}</span>
                    <ng-template #sinCanal><span class="text-xs text-slate-400">—</span></ng-template>
                  </td>
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
export class VentasComponent implements OnInit {
  dataset = inject(DatasetService);
  categoriasService = inject(CategoriasService);
  meses = MESES;
  pageSize = PAGE_SIZE;
  Math = Math;

  listoParaCalcular = signal(false);

  texto = signal('');
  vendedorFiltro = signal('');
  canalFiltro = signal('');
  mesFiltro = signal<number>(new Date().getMonth() + 1); // por defecto el mes actual
  tipoMovFiltro = signal('');
  desde = signal('');
  hasta = signal('');
  pagina = signal(0);

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);

    // Ajusta el mes por defecto según el año activo (igual que el dashboard).
    effect(() => {
      const anio = this.dataset.anioActivo();
      const hoy = new Date();
      if (anio === hoy.getFullYear()) this.mesFiltro.set(hoy.getMonth() + 1);
      else if (anio != null) this.mesFiltro.set(12);
    }, { allowSignalWrites: true });
  }

  async ngOnInit() {
    if (this.categoriasService.totalCargados() === 0) {
      await this.categoriasService.cargar();
    }
  }

  // ---------- Selector de mes ----------
  etiquetaMes(): string {
    const m = this.mesFiltro();
    if (m === 0) return 'Todos los meses';
    const anio = this.dataset.anioActivo();
    return MESES_LARGO[m - 1] + (anio ? ' ' + anio : '');
  }
  puedeAnterior(): boolean { return this.mesFiltro() > 1; }
  puedeSiguiente(): boolean { return this.mesFiltro() > 0 && this.mesFiltro() < 12; }
  mesAnterior(): void {
    const v = this.mesFiltro();
    this.mesFiltro.set(v <= 1 ? 1 : v - 1);
    this.pagina.set(0);
  }
  mesSiguiente(): void {
    const v = this.mesFiltro();
    this.mesFiltro.set(v < 1 ? 1 : v >= 12 ? 12 : v + 1);
    this.pagina.set(0);
  }
  toggleTodos(): void {
    this.mesFiltro.set(this.mesFiltro() === 0 ? new Date().getMonth() + 1 : 0);
    this.pagina.set(0);
  }

  // ---------- Calendario (rango de fechas) ----------
  rangoActivo(): boolean { return !!(this.desde() || this.hasta()); }
  limpiarRango(): void {
    this.desde.set('');
    this.hasta.set('');
    this.pagina.set(0);
  }
  private aNum(fecha: string): number {
    const [y, m, d] = fecha.split('-').map(Number);
    return (y || 0) * 10000 + (m || 0) * 100 + (d || 0);
  }

  // ---------- Canal (categoría del cliente) ----------
  canalDe(r: RegistroVenta): string {
    return this.categoriasService.categoriaDeRut(r.clienteRut) ?? '';
  }
  canalBadge(canal: string): string {
    return CANAL_BADGE[canal?.toUpperCase()] ?? 'bg-slate-100 text-slate-600';
  }

  filtradas = computed(() => {
    const rows = this.dataset.registros();
    const t = this.texto().toLowerCase().trim();
    const vend = this.vendedorFiltro();
    const canal = this.canalFiltro();
    const mes = this.mesFiltro();
    const tipo = this.tipoMovFiltro();
    const usarRango = this.rangoActivo();
    const dnum = this.desde() ? this.aNum(this.desde()) : -Infinity;
    const hnum = this.hasta() ? this.aNum(this.hasta()) : Infinity;
    const cat = this.categoriasService;

    return rows.filter((r) => {
      if (vend && r.vendedor !== vend) return false;
      if (canal && (cat.categoriaDeRut(r.clienteRut) ?? '') !== canal) return false;
      if (tipo && r.tipoMovimiento !== tipo) return false;
      if (usarRango) {
        const f = r.anio * 10000 + r.mes * 100 + r.dia;
        if (f < dnum || f > hnum) return false;
      } else if (mes && r.mes !== mes) {
        return false;
      }
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
    let bruto = 0, neto = 0, margen = 0;
    const docs = new Set<string>();
    for (const r of f) {
      bruto += r.ventaTotalBruta;
      neto += r.ventaTotalNeta;
      margen += r.margen;
      if (r.numeroDocumento) docs.add(r.numeroDocumento);
    }
    return {
      bruto,
      neto,
      margen,
      margenPct: bruto > 0 ? (margen / bruto) * 100 : 0,
      transacciones: docs.size,   // facturas emitidas
      lineas: f.length,           // productos vendidos (líneas)
    };
  });

  vendedoresOpciones = computed(() => this.unique('vendedor').sort());
  tiposMovOpciones = computed(() => this.unique('tipoMovimiento').sort());

  canalesOpciones = computed<string[]>(() => {
    const cat = this.categoriasService;
    const set = new Set<string>();
    for (const r of this.dataset.registros()) {
      const c = cat.categoriaDeRut(r.clienteRut);
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  });

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
