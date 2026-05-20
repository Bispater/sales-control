import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RegistroVenta } from '../../models/dataset';
import { DatasetService } from '../../services/dataset.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { colorPorNombre, iniciales } from '../../utils/colores';

const PAGE_SIZE = 24;

interface ResumenCliente {
  rut: string;
  nombre: string;
  email: string;
  comuna: string;
  ciudad: string;
  facturacion: number;
  margen: number;
  margenPct: number;
  cantidad: number;
  ultimaCompra: string;
  vendedorPrincipal: string;
}

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, EmptyStateComponent],
  template: `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Directorio de Clientes</h1>
      <p class="text-sm text-slate-500 mt-1">
        Cartera de clientes {{ dataset.anioActivo() ? '· Año ' + dataset.anioActivo() : '' }}
      </p>
    </div>

    <ng-container *ngIf="dataset.cargando() || !listoParaCalcular(); else listo">
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-12 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <span class="inline-block w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
        <span>Cargando clientes...</span>
      </div>
    </ng-container>

    <ng-template #listo>
      <ng-container *ngIf="dataset.registros().length === 0; else ok">
        <app-empty-state
          titulo="Sin datos cargados"
          descripcion="Sube un CSV con tus ventas en la sección Datos para ver tus clientes."
          enlace="/datos"
          enlaceLabel="Ir a Datos"
        ></app-empty-state>
      </ng-container>

      <ng-template #ok>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Clientes únicos</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ todosClientes().length | number }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Facturación total</p>
            <p class="text-2xl font-bold text-emerald-600 mt-1">{{ formatoCLP(kpis().facturacion) }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Ticket promedio</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ formatoCLP(kpis().ticket) }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <p class="text-sm text-slate-500 font-medium">Top 10% genera</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ kpis().pctTop | number:'1.0-0' }}%</p>
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
              placeholder="Buscar por nombre, RUT, email, comuna..."
              class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div *ngFor="let c of paginaActual()" class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="min-w-0">
                <p class="font-semibold text-slate-900 truncate" [title]="c.nombre">{{ c.nombre }}</p>
                <p class="text-xs text-slate-500 truncate">{{ c.rut }}</p>
              </div>
            </div>

            <div class="text-xs text-slate-600 space-y-0.5 mb-3">
              <p *ngIf="c.email" class="truncate" [title]="c.email">{{ c.email }}</p>
              <p *ngIf="c.comuna">{{ c.comuna }}{{ c.ciudad && c.ciudad !== c.comuna ? ', ' + c.ciudad : '' }}</p>
            </div>

            <div class="border-t border-slate-100 pt-3 space-y-1">
              <div class="flex justify-between text-sm">
                <span class="text-slate-500">Facturación</span>
                <span class="font-semibold text-slate-900">{{ formatoCLP(c.facturacion) }}</span>
              </div>
              <div class="flex justify-between text-xs text-slate-500">
                <span>Líneas</span>
                <span>{{ c.cantidad | number }}</span>
              </div>
              <div class="flex justify-between text-xs text-slate-500" *ngIf="c.margen">
                <span>Margen</span>
                <span>{{ formatoCLP(c.margen) }} ({{ c.margenPct | number:'1.1-1' }}%)</span>
              </div>
              <div class="flex justify-between text-xs text-slate-500" *ngIf="c.vendedorPrincipal">
                <span>Vendedor</span>
                <span class="truncate ml-2" [title]="c.vendedorPrincipal">{{ c.vendedorPrincipal }}</span>
              </div>
              <div class="flex justify-between text-xs text-slate-500" *ngIf="c.ultimaCompra">
                <span>Última compra</span>
                <span>{{ c.ultimaCompra }}</span>
              </div>
            </div>

            <button (click)="abrir(c)" class="w-full mt-4 text-sm font-medium text-brand-600 hover:bg-brand-50 py-2 rounded-lg transition">
              Ver Detalles
            </button>
          </div>
          <div *ngIf="paginaActual().length === 0" class="col-span-full text-center text-sm text-slate-400 py-12">
            No se encontraron clientes con los filtros aplicados.
          </div>
        </div>

        <div *ngIf="totalPaginas() > 1" class="flex items-center justify-between bg-white rounded-xl shadow-card border border-slate-100 p-4 mt-4">
          <button
            (click)="pagina.set(Math.max(0, pagina() - 1))"
            [disabled]="pagina() === 0"
            class="text-sm px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >Anterior</button>
          <span class="text-xs text-slate-500">
            Página {{ pagina() + 1 }} de {{ totalPaginas() }} · {{ filtrados().length | number }} clientes
          </span>
          <button
            (click)="pagina.set(Math.min(totalPaginas() - 1, pagina() + 1))"
            [disabled]="pagina() >= totalPaginas() - 1"
            class="text-sm px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >Siguiente</button>
        </div>
      </ng-template>
    </ng-template>

    <div *ngIf="seleccionado()" class="fixed inset-0 bg-slate-900/40 flex items-start justify-center p-6 z-50 overflow-y-auto" (click)="cerrar()">
      <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full mt-12" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between p-5 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg text-white flex items-center justify-center font-bold"
                 [style.backgroundColor]="color(seleccionado()!.nombre)">
              {{ inic(seleccionado()!.nombre) }}
            </div>
            <div class="min-w-0">
              <p class="font-bold text-slate-900 truncate" [title]="seleccionado()!.nombre">{{ seleccionado()!.nombre }}</p>
              <p class="text-xs text-slate-500">{{ seleccionado()!.rut }}</p>
            </div>
          </div>
          <button (click)="cerrar()" class="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="p-5 space-y-5">
          <section *ngIf="seleccionado() as s">
            <h4 class="text-sm font-semibold text-slate-900 mb-2">Contacto</h4>
            <div class="text-sm text-slate-700 space-y-1">
              <p *ngIf="s.email"><span class="text-slate-500">Email:</span> {{ s.email }}</p>
              <p *ngIf="s.comuna"><span class="text-slate-500">Comuna:</span> {{ s.comuna }}</p>
              <p *ngIf="s.ciudad && s.ciudad !== s.comuna"><span class="text-slate-500">Ciudad:</span> {{ s.ciudad }}</p>
            </div>
          </section>

          <section *ngIf="seleccionado() as s">
            <h4 class="text-sm font-semibold text-slate-900 mb-2">Resumen</h4>
            <div class="grid grid-cols-3 gap-2">
              <div class="bg-emerald-50 rounded-lg p-3 text-center">
                <p class="text-xs text-slate-500">Facturado</p>
                <p class="text-base font-bold text-emerald-700 mt-1">{{ formatoCLP(s.facturacion) }}</p>
              </div>
              <div class="bg-sky-50 rounded-lg p-3 text-center">
                <p class="text-xs text-slate-500">Líneas</p>
                <p class="text-base font-bold text-sky-700 mt-1">{{ s.cantidad | number }}</p>
              </div>
              <div class="bg-violet-50 rounded-lg p-3 text-center">
                <p class="text-xs text-slate-500">Margen</p>
                <p class="text-base font-bold text-violet-700 mt-1">{{ s.margenPct | number:'1.1-1' }}%</p>
              </div>
            </div>
          </section>

          <section>
            <h4 class="text-sm font-semibold text-slate-900 mb-2">Historial de Compras (últimas 10)</h4>
            <div *ngIf="historial().length === 0" class="text-sm text-slate-400">Sin compras registradas.</div>
            <div class="space-y-2">
              <div *ngFor="let v of historial()" class="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-slate-900 truncate">{{ v.producto }}</p>
                  <p class="text-xs text-slate-500 truncate">
                    {{ v.vendedor }} · {{ v.fechaHoraVenta || v.fechaEmision }} · Doc {{ v.numeroDocumento }}
                  </p>
                </div>
                <p class="text-sm font-bold text-slate-900 whitespace-nowrap ml-3">{{ formatoCLP(v.ventaTotalBruta) }}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class ClientesComponent {
  dataset = inject(DatasetService);
  Math = Math;
  pageSize = PAGE_SIZE;

  // Render diferido: cede el hilo principal para pintar la página y el spinner
  // antes de que corran los computeds pesados sobre miles de registros.
  listoParaCalcular = signal(false);

  texto = signal('');
  pagina = signal(0);
  seleccionado = signal<ResumenCliente | null>(null);

  constructor() {
    setTimeout(() => this.listoParaCalcular.set(true), 0);
  }

  todosClientes = computed<ResumenCliente[]>(() => {
    const map = new Map<string, ResumenCliente & { _vendedores: Map<string, number> }>();
    for (const r of this.dataset.registros()) {
      const id = r.clienteRut?.trim() || r.nombreCliente?.trim();
      if (!id) continue;
      let prev = map.get(id);
      if (!prev) {
        prev = {
          rut: r.clienteRut || '',
          nombre: r.nombreCliente || id,
          email: r.emailCliente || '',
          comuna: r.clienteComuna || '',
          ciudad: r.clienteCiudad || '',
          facturacion: 0,
          margen: 0,
          margenPct: 0,
          cantidad: 0,
          ultimaCompra: '',
          vendedorPrincipal: '',
          _vendedores: new Map<string, number>(),
        };
        map.set(id, prev);
      }
      prev.facturacion += r.ventaTotalBruta;
      prev.margen += r.margen;
      prev.cantidad += 1;
      if (r.vendedor) {
        prev._vendedores.set(r.vendedor, (prev._vendedores.get(r.vendedor) ?? 0) + r.ventaTotalBruta);
      }
      const fecha = r.fechaHoraVenta || r.fechaEmision;
      if (fecha && fecha > prev.ultimaCompra) prev.ultimaCompra = fecha;
    }
    const arr = Array.from(map.values()).map((c) => {
      c.margenPct = c.facturacion > 0 ? (c.margen / c.facturacion) * 100 : 0;
      let topVendedor = '';
      let max = 0;
      c._vendedores.forEach((v, k) => {
        if (v > max) {
          max = v;
          topVendedor = k;
        }
      });
      c.vendedorPrincipal = topVendedor;
      delete (c as { _vendedores?: Map<string, number> })._vendedores;
      return c as ResumenCliente;
    });
    arr.sort((a, b) => b.facturacion - a.facturacion);
    return arr;
  });

  filtrados = computed<ResumenCliente[]>(() => {
    const t = this.texto().toLowerCase().trim();
    if (!t) return this.todosClientes();
    return this.todosClientes().filter(
      (c) =>
        c.nombre?.toLowerCase().includes(t) ||
        c.rut?.toLowerCase().includes(t) ||
        c.email?.toLowerCase().includes(t) ||
        c.comuna?.toLowerCase().includes(t),
    );
  });

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / PAGE_SIZE)));

  paginaActual = computed(() => {
    const inicio = this.pagina() * PAGE_SIZE;
    return this.filtrados().slice(inicio, inicio + PAGE_SIZE);
  });

  kpis = computed(() => {
    const lista = this.todosClientes();
    const facturacion = lista.reduce((acc, c) => acc + c.facturacion, 0);
    const totalDocs = lista.reduce((acc, c) => acc + c.cantidad, 0);
    const ticket = totalDocs > 0 ? facturacion / totalDocs : 0;
    const top10 = Math.max(1, Math.ceil(lista.length * 0.1));
    const topFact = lista.slice(0, top10).reduce((acc, c) => acc + c.facturacion, 0);
    const pctTop = facturacion > 0 ? (topFact / facturacion) * 100 : 0;
    return { facturacion, ticket, pctTop };
  });

  historial = computed<RegistroVenta[]>(() => {
    const c = this.seleccionado();
    if (!c) return [];
    return this.dataset.registros()
      .filter((r) => (c.rut ? r.clienteRut === c.rut : r.nombreCliente === c.nombre))
      .sort((a, b) => (a.fechaHoraVenta < b.fechaHoraVenta ? 1 : -1))
      .slice(0, 10);
  });

  abrir(c: ResumenCliente) {
    this.seleccionado.set(c);
  }
  cerrar() {
    this.seleccionado.set(null);
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
