import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatasetService } from '../../services/dataset.service';
import {
  Tarea,
  TareaEstado,
  TareaPrioridad,
  TareaTipo,
  TareasService,
} from '../../services/tareas.service';

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TIPOS: TareaTipo[] = ['Producto Foco', 'Ruta', 'Venta Específica', 'Otro'];
const PRIORIDADES: TareaPrioridad[] = ['Alta', 'Media', 'Baja'];
const ESTADOS: TareaEstado[] = ['Pendiente', 'En Progreso', 'Completada'];

interface FormTarea {
  titulo: string;
  descripcion: string;
  tipo: TareaTipo;
  prioridad: TareaPrioridad;
  vendedor: string;
  fechaVencimiento: string;
}

@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Tareas</h1>
        <p class="text-sm text-slate-500 mt-1">Gestión de tareas y objetivos del equipo</p>
      </div>
      <button (click)="abrirNueva()" class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        Nueva Tarea
      </button>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-center justify-between">
        <div><p class="text-sm text-slate-500">Total Tareas</p><p class="text-3xl font-bold text-slate-900 mt-1">{{ kpis().total }}</p></div>
        <span class="w-9 h-9 rounded-full border-2 border-slate-300"></span>
      </div>
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-center justify-between">
        <div><p class="text-sm text-slate-500">Pendientes</p><p class="text-3xl font-bold text-amber-500 mt-1">{{ kpis().pendientes }}</p></div>
        <span class="w-9 h-9 rounded-full border-2 border-amber-400"></span>
      </div>
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-center justify-between">
        <div><p class="text-sm text-slate-500">En Progreso</p><p class="text-3xl font-bold text-blue-600 mt-1">{{ kpis().enProgreso }}</p></div>
        <span class="w-9 h-9 rounded-full border-2 border-blue-500"></span>
      </div>
      <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5 flex items-center justify-between">
        <div><p class="text-sm text-slate-500">Completadas</p><p class="text-3xl font-bold text-emerald-600 mt-1">{{ kpis().completadas }}</p></div>
        <span class="w-9 h-9 inline-flex items-center justify-center rounded-full border-2 border-emerald-500 text-emerald-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
        </span>
      </div>
    </div>

    <!-- Filtros -->
    <div class="grid grid-cols-1 md:grid-cols-[1fr_200px_200px_200px] gap-3 mb-4">
      <div class="relative">
        <span class="absolute inset-y-0 left-3 flex items-center text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
        </span>
        <input [ngModel]="texto()" (ngModelChange)="texto.set($event)" placeholder="Buscar tareas..."
               class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
      <select [ngModel]="vendedorFiltro()" (ngModelChange)="vendedorFiltro.set($event)" class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
        <option value="">Todos los vendedores</option>
        <option *ngFor="let v of vendedoresOpciones()" [value]="v">{{ v }}</option>
      </select>
      <select [ngModel]="estadoFiltro()" (ngModelChange)="estadoFiltro.set($event)" class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
        <option value="">Todos los estados</option>
        <option *ngFor="let e of estados" [value]="e">{{ e }}</option>
      </select>
      <select [ngModel]="tipoFiltro()" (ngModelChange)="tipoFiltro.set($event)" class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
        <option value="">Todos los tipos</option>
        <option *ngFor="let t of tipos" [value]="t">{{ t }}</option>
      </select>
    </div>

    <!-- Lista -->
    <div *ngIf="filtradas().length === 0" class="bg-white rounded-xl shadow-card border border-slate-100 p-12 text-center text-sm text-slate-400">
      No hay tareas. Crea una con "Nueva Tarea" o impórtalas desde la sección Datos.
    </div>

    <div class="space-y-3">
      <div *ngFor="let t of filtradas()" class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
        <div class="flex items-start gap-3">
          <button (click)="tareasService.ciclarEstado(t.id)" [title]="'Estado: ' + t.estado + ' (clic para cambiar)'"
                  class="mt-0.5 shrink-0">
            <span *ngIf="t.estado === 'Completada'; else circulo" class="w-6 h-6 inline-flex items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
            </span>
            <ng-template #circulo>
              <span class="w-6 h-6 inline-block rounded-full border-2 hover:border-brand-500 transition"
                    [class.border-amber-400]="t.estado === 'Pendiente'" [class.border-blue-500]="t.estado === 'En Progreso'"></span>
            </ng-template>
          </button>

          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-base font-semibold text-slate-900" [class.line-through]="t.estado === 'Completada'" [class.text-slate-400]="t.estado === 'Completada'">{{ t.titulo }}</p>
                <p *ngIf="t.descripcion" class="text-sm text-slate-500 mt-0.5">{{ t.descripcion }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" [class]="tipoBadge(t.tipo)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" [attr.d]="tipoIcon(t.tipo)"/></svg>
                  {{ t.tipo }}
                </span>
                <span class="text-[11px] font-medium px-2 py-0.5 rounded-full" [class]="prioridadBadge(t.prioridad)">{{ t.prioridad }}</span>
              </div>
            </div>

            <div class="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
              <span class="inline-flex items-center gap-1" *ngIf="t.vendedor">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
                {{ t.vendedor }}
              </span>
              <span class="inline-flex items-center gap-1" *ngIf="t.cliente">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.999 2.999 0 0 0 4.5 0 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"/></svg>
                {{ t.cliente }}
              </span>
              <span class="inline-flex items-center gap-1" *ngIf="t.fechaVencimiento">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>
                Vence: {{ fechaCorta(t.fechaVencimiento) }}
              </span>
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" [class]="estadoBadge(t.estado)">{{ t.estado }}</span>
              <span *ngIf="t.estado === 'Completada' && t.fechaCompletada" class="text-emerald-600">Completada: {{ fechaCorta(t.fechaCompletada) }}</span>
              <button (click)="tareasService.eliminar(t.id)" class="ml-auto text-slate-400 hover:text-rose-600" title="Eliminar">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== Modal Nueva Tarea ========== -->
    <div *ngIf="modalAbierto()" class="fixed inset-0 bg-slate-900/40 flex items-start justify-center p-4 z-50 overflow-y-auto" (click)="cerrarModal()">
      <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full mt-10" (click)="$event.stopPropagation()">
        <div class="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 class="text-lg font-bold text-slate-900">Nueva Tarea</h2>
          <button (click)="cerrarModal()" class="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Título <span class="text-rose-500">*</span></label>
            <input [(ngModel)]="form.titulo" placeholder="Nombre de la tarea"
                   class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <textarea [(ngModel)]="form.descripcion" rows="3" placeholder="Descripción detallada de la tarea"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white resize-none"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Tipo de Tarea <span class="text-rose-500">*</span></label>
              <select [(ngModel)]="form.tipo" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option *ngFor="let t of tipos" [value]="t">{{ t }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Prioridad <span class="text-rose-500">*</span></label>
              <select [(ngModel)]="form.prioridad" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option *ngFor="let p of prioridades" [value]="p">{{ p }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Asignar a <span class="text-rose-500">*</span></label>
              <select [(ngModel)]="form.vendedor" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Selecciona un vendedor</option>
                <option *ngFor="let v of vendedoresOpciones()" [value]="v">{{ v }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Fecha de vencimiento <span class="text-rose-500">*</span></label>
              <input type="date" [(ngModel)]="form.fechaVencimiento"
                     class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white" />
            </div>
          </div>
          <!-- Cliente con buscador por nombre -->
          <div class="relative">
            <label class="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
            <input [ngModel]="clienteQuery()" (ngModelChange)="clienteQuery.set($event); clienteAbierto.set(true)"
                   (focus)="clienteAbierto.set(true)" (blur)="cerrarPanelCliente()"
                   placeholder="Buscar cliente por nombre..."
                   class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white" />
            <div *ngIf="clienteAbierto() && sugerenciasCliente().length"
                 class="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              <button *ngFor="let c of sugerenciasCliente()" type="button"
                      (mousedown)="$event.preventDefault(); elegirCliente(c)"
                      class="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 truncate">{{ c }}</button>
            </div>
          </div>
          <p *ngIf="errorForm()" class="text-sm text-rose-600">{{ errorForm() }}</p>
        </div>

        <div class="flex items-center gap-3 p-5 border-t border-slate-100">
          <button (click)="cerrarModal()" class="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-lg transition">Cancelar</button>
          <button (click)="crearTarea()" class="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg transition">Crear Tarea</button>
        </div>
      </div>
    </div>
  `,
})
export class TareasComponent implements OnInit {
  tareasService = inject(TareasService);
  private dataset = inject(DatasetService);

  tipos = TIPOS;
  prioridades = PRIORIDADES;
  estados = ESTADOS;

  texto = signal('');
  vendedorFiltro = signal('');
  estadoFiltro = signal<'' | TareaEstado>('');
  tipoFiltro = signal<'' | TareaTipo>('');

  modalAbierto = signal(false);
  errorForm = signal('');
  form: FormTarea = this.formVacio();

  // Buscador de cliente del formulario de tarea.
  clienteQuery = signal('');
  clienteAbierto = signal(false);

  async ngOnInit() {
    if (this.dataset.registros().length === 0) {
      const anio = this.dataset.anioActivo() ?? this.dataset.aniosDisponibles()[0]?.anio;
      if (anio != null) await this.dataset.cargarAnio(anio);
    }
  }

  vendedoresOpciones = computed<string[]>(() => {
    const set = new Set<string>();
    for (const r of this.dataset.registros()) {
      const v = (r.vendedor || '').trim();
      if (v) set.add(v);
    }
    for (const t of this.tareasService.tareas()) {
      if (t.vendedor) set.add(t.vendedor);
    }
    return Array.from(set).sort();
  });

  // Nombres de clientes (desde ventas) para el buscador del formulario.
  clientesOpciones = computed<string[]>(() => {
    const set = new Set<string>();
    for (const r of this.dataset.registros()) {
      const n = (r.nombreCliente || '').trim();
      if (n) set.add(n);
    }
    return Array.from(set).sort();
  });

  sugerenciasCliente = computed<string[]>(() => {
    const q = this.clienteQuery().toLowerCase().trim();
    if (!q) return this.clientesOpciones().slice(0, 20);
    return this.clientesOpciones().filter((c) => c.toLowerCase().includes(q)).slice(0, 20);
  });

  kpis = computed(() => {
    let pendientes = 0, enProgreso = 0, completadas = 0;
    for (const t of this.tareasService.tareas()) {
      if (t.estado === 'Pendiente') pendientes++;
      else if (t.estado === 'En Progreso') enProgreso++;
      else completadas++;
    }
    return { total: this.tareasService.tareas().length, pendientes, enProgreso, completadas };
  });

  filtradas = computed<Tarea[]>(() => {
    const t = this.texto().toLowerCase().trim();
    const vend = this.vendedorFiltro();
    const est = this.estadoFiltro();
    const tip = this.tipoFiltro();
    return this.tareasService.tareas().filter((x) => {
      if (vend && x.vendedor !== vend) return false;
      if (est && x.estado !== est) return false;
      if (tip && x.tipo !== tip) return false;
      if (t) {
        const blob = (x.titulo + ' ' + x.descripcion + ' ' + x.vendedor).toLowerCase();
        if (!blob.includes(t)) return false;
      }
      return true;
    });
  });

  abrirNueva(): void {
    this.form = this.formVacio();
    this.clienteQuery.set('');
    this.clienteAbierto.set(false);
    this.errorForm.set('');
    this.modalAbierto.set(true);
  }
  cerrarModal(): void { this.modalAbierto.set(false); }

  elegirCliente(nombre: string): void {
    this.clienteQuery.set(nombre);
    this.clienteAbierto.set(false);
  }
  cerrarPanelCliente(): void {
    // Delay para que un clic en la sugerencia se registre antes de cerrar.
    setTimeout(() => this.clienteAbierto.set(false), 150);
  }

  crearTarea(): void {
    const f = this.form;
    if (!f.titulo.trim()) { this.errorForm.set('El título es obligatorio.'); return; }
    if (!f.vendedor) { this.errorForm.set('Debes asignar la tarea a un vendedor.'); return; }
    if (!f.fechaVencimiento) { this.errorForm.set('Debes indicar la fecha de vencimiento.'); return; }
    this.tareasService.agregar({
      titulo: f.titulo.trim(),
      descripcion: f.descripcion.trim(),
      tipo: f.tipo,
      prioridad: f.prioridad,
      vendedor: f.vendedor,
      cliente: this.clienteQuery().trim(),
      fechaVencimiento: f.fechaVencimiento,
      estado: 'Pendiente',
    });
    this.modalAbierto.set(false);
  }

  private formVacio(): FormTarea {
    return { titulo: '', descripcion: '', tipo: 'Otro', prioridad: 'Media', vendedor: '', fechaVencimiento: '' };
  }

  fechaCorta(iso: string): string {
    const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return iso;
    return `${+m[3]} ${MESES_CORTO[+m[2] - 1]} ${m[1]}`;
  }

  tipoBadge(tipo: TareaTipo): string {
    if (tipo === 'Producto Foco') return 'bg-violet-100 text-violet-700';
    if (tipo === 'Ruta') return 'bg-sky-100 text-sky-700';
    if (tipo === 'Venta Específica') return 'bg-emerald-100 text-emerald-700';
    return 'bg-slate-100 text-slate-600';
  }
  tipoIcon(tipo: TareaTipo): string {
    if (tipo === 'Producto Foco') return 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z';
    if (tipo === 'Ruta') return 'M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z';
    if (tipo === 'Venta Específica') return 'M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z M6 6h.008v.008H6V6Z';
    return 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z';
  }
  prioridadBadge(p: TareaPrioridad): string {
    if (p === 'Alta') return 'bg-rose-100 text-rose-700';
    if (p === 'Media') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  }
  estadoBadge(e: TareaEstado): string {
    if (e === 'Pendiente') return 'bg-amber-100 text-amber-700';
    if (e === 'En Progreso') return 'bg-blue-100 text-blue-700';
    return 'bg-emerald-100 text-emerald-700';
  }
}
