import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProgresoCarga } from '../../models/dataset';
import { CategoriasService } from '../../services/categorias.service';
import { DatasetService } from '../../services/dataset.service';
import { MetasService } from '../../services/metas.service';

interface EstadoSubida {
  archivo: File | null;
  arrastrando: boolean;
  subiendo: boolean;
  progreso: ProgresoCarga | null;
  error: string;
}

const estadoInicial: EstadoSubida = {
  archivo: null,
  arrastrando: false,
  subiendo: false,
  progreso: null,
  error: '',
};

@Component({
  selector: 'app-datos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Gestión de Datos</h1>
      <p class="text-sm text-slate-500 mt-1">Carga los archivos CSV de ventas, categorías de clientes y metas.</p>
    </div>

    <!-- ========== Ventas ========== -->
    <div class="bg-white rounded-xl shadow-card border border-slate-100 p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold text-slate-900">1. Ventas (CSV anual)</h2>
        <span class="text-xs text-slate-500">{{ datasetService.aniosDisponibles().length }} año(s) cargado(s)</span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Año del dataset</label>
            <select
              [(ngModel)]="anioVentas"
              [disabled]="ventas().subiendo"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option *ngFor="let a of aniosOpciones" [value]="a">{{ a }}</option>
            </select>
          </div>

          <ng-container *ngTemplateOutlet="dropZone; context: { $implicit: 'ventas', placeholder: 'Arrastra o haz clic para seleccionar el CSV de ventas' }"></ng-container>
          <ng-container *ngTemplateOutlet="feedback; context: { $implicit: 'ventas' }"></ng-container>

          <button
            (click)="subirVentas()"
            [disabled]="!ventas().archivo || ventas().subiendo"
            class="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition"
          >
            {{ ventas().subiendo ? 'Subiendo...' : 'Subir ventas' }}
          </button>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-slate-900 mb-2">Datasets cargados</h3>
          <p *ngIf="cargandoLista()" class="text-sm text-slate-400">Cargando...</p>
          <div *ngIf="!cargandoLista() && datasetService.aniosDisponibles().length === 0" class="text-sm text-slate-400">
            No hay datasets cargados.
          </div>
          <div *ngFor="let m of datasetService.aniosDisponibles()" class="border border-slate-100 rounded-lg p-3 mb-2 last:mb-0"
               [class.ring-2]="datasetService.anioActivo() === m.anio"
               [class.ring-brand-500]="datasetService.anioActivo() === m.anio">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-lg font-bold text-slate-900">{{ m.anio }}</p>
                <p class="text-xs text-slate-500">{{ m.totalFilas | number }} registros</p>
              </div>
              <div class="flex items-center gap-1">
                <button
                  *ngIf="datasetService.anioActivo() !== m.anio"
                  (click)="datasetService.cargarAnio(m.anio)"
                  class="text-xs font-medium text-brand-600 hover:bg-brand-50 px-2 py-1 rounded"
                >
                  Usar
                </button>
                <button
                  (click)="confirmarBorrarVentas(m.anio)"
                  class="text-rose-600 hover:bg-rose-50 p-1 rounded transition"
                  title="Eliminar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
                  </svg>
                </button>
              </div>
            </div>
            <p class="text-xs text-slate-500 mt-2">{{ m.ultimaCarga | date:'dd MMM yyyy HH:mm' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== Categorías de clientes ========== -->
    <div class="bg-white rounded-xl shadow-card border border-slate-100 p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-semibold text-slate-900">2. Categorías de clientes (RUT → HOLDING/TRABAJADORES/TERCEROS)</h2>
          <p class="text-xs text-slate-500 mt-1">CSV con columnas <code>rut</code>, <code>nombre</code> (opcional), <code>categoria</code>.</p>
        </div>
        <span class="text-xs text-slate-500">{{ categoriasService.totalCargados() | number }} clientes mapeados</span>
      </div>

      <div class="space-y-4">
        <ng-container *ngTemplateOutlet="dropZone; context: { $implicit: 'categorias', placeholder: 'Arrastra o haz clic para seleccionar el CSV de categorías' }"></ng-container>
        <ng-container *ngTemplateOutlet="feedback; context: { $implicit: 'categorias' }"></ng-container>

        <div class="flex gap-2">
          <button
            (click)="subirCategorias()"
            [disabled]="!categorias().archivo || categorias().subiendo"
            class="flex-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition"
          >
            {{ categorias().subiendo ? 'Subiendo...' : 'Subir categorías' }}
          </button>
          <button
            *ngIf="categoriasService.totalCargados() > 0"
            (click)="confirmarBorrarCategorias()"
            [disabled]="categorias().subiendo"
            class="px-4 py-2.5 border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50 text-sm font-medium rounded-lg transition"
          >
            Borrar todo
          </button>
        </div>
        <p *ngIf="categoriasService.ultimaCarga()" class="text-xs text-slate-500">
          Última actualización: {{ categoriasService.ultimaCarga() | date:'dd MMM yyyy HH:mm' }}
        </p>
      </div>
    </div>

    <!-- ========== Metas de vendedores ========== -->
    <div class="bg-white rounded-xl shadow-card border border-slate-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-semibold text-slate-900">3. Metas mensuales por vendedor</h2>
          <p class="text-xs text-slate-500 mt-1">CSV ancho con columnas <code>vendedor</code>, <code>categoria</code> (opcional), <code>ENERO</code>…<code>DICIEMBRE</code>.</p>
        </div>
        <span class="text-xs text-slate-500">{{ metasService.metas().length }} celdas cargadas (año {{ metasService.anioCargado() }})</span>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Año de las metas</label>
          <select
            [(ngModel)]="anioMetas"
            [disabled]="metas().subiendo"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option *ngFor="let a of aniosOpciones" [value]="a">{{ a }}</option>
          </select>
        </div>

        <ng-container *ngTemplateOutlet="dropZone; context: { $implicit: 'metas', placeholder: 'Arrastra o haz clic para seleccionar el CSV de metas' }"></ng-container>
        <ng-container *ngTemplateOutlet="feedback; context: { $implicit: 'metas' }"></ng-container>

        <div class="flex gap-2">
          <button
            (click)="subirMetas()"
            [disabled]="!metas().archivo || metas().subiendo"
            class="flex-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition"
          >
            {{ metas().subiendo ? 'Subiendo...' : 'Subir metas' }}
          </button>
          <button
            *ngIf="metasService.metas().length > 0"
            (click)="confirmarBorrarMetas()"
            [disabled]="metas().subiendo"
            class="px-4 py-2.5 border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50 text-sm font-medium rounded-lg transition"
          >
            Borrar año {{ metasService.anioCargado() }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========== Templates reutilizables ========== -->
    <ng-template #dropZone let-tipo let-placeholder="placeholder">
      <label
        class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition"
        [class.border-slate-200]="!estado(tipo).arrastrando"
        [class.border-brand-500]="estado(tipo).arrastrando"
        [class.bg-slate-50]="!estado(tipo).arrastrando"
        [class.bg-brand-50]="estado(tipo).arrastrando"
        [class.opacity-50]="estado(tipo).subiendo"
        [class.cursor-not-allowed]="estado(tipo).subiendo"
        (dragover)="$event.preventDefault(); setArrastrando(tipo, true)"
        (dragleave)="setArrastrando(tipo, false)"
        (drop)="onDrop($event, tipo)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/>
        </svg>
        <p class="text-sm text-slate-600">
          {{ estado(tipo).archivo?.name || placeholder }}
        </p>
        <input type="file" accept=".csv,text/csv" class="hidden" (change)="onFile($event, tipo)" [disabled]="estado(tipo).subiendo" />
      </label>
    </ng-template>

    <ng-template #feedback let-tipo>
      <div *ngIf="estado(tipo).error" class="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3">
        {{ estado(tipo).error }}
      </div>
      <div *ngIf="estado(tipo).progreso as p" class="bg-slate-50 border border-slate-100 rounded-lg p-3">
        <div class="flex items-center justify-between mb-1 text-sm">
          <span class="font-medium text-slate-700">{{ p.mensaje }}</span>
          <span class="text-slate-500">{{ p.pct }}%</span>
        </div>
        <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div class="h-full bg-brand-600 transition-all duration-200" [style.width.%]="p.pct"></div>
        </div>
        <div *ngIf="p.filasProcesadas !== undefined" class="text-xs text-slate-500 mt-1">
          {{ p.filasProcesadas | number }} filas procesadas
        </div>
        <div *ngIf="p.chunkActual !== undefined" class="text-xs text-slate-500 mt-1">
          Lote {{ p.chunkActual }} de {{ p.totalChunks }}
        </div>
      </div>
    </ng-template>
  `,
})
export class DatosComponent implements OnInit {
  datasetService = inject(DatasetService);
  categoriasService = inject(CategoriasService);
  metasService = inject(MetasService);

  anioActual = new Date().getFullYear();
  aniosOpciones = Array.from({ length: 8 }, (_, i) => this.anioActual - i + 1).reverse();
  anioVentas = this.anioActual;
  anioMetas = this.anioActual;

  ventas = signal<EstadoSubida>({ ...estadoInicial });
  categorias = signal<EstadoSubida>({ ...estadoInicial });
  metas = signal<EstadoSubida>({ ...estadoInicial });

  cargandoLista = signal(true);

  estado(tipo: 'ventas' | 'categorias' | 'metas'): EstadoSubida {
    return tipo === 'ventas' ? this.ventas() : tipo === 'categorias' ? this.categorias() : this.metas();
  }

  setEstado(
    tipo: 'ventas' | 'categorias' | 'metas',
    patch: Partial<EstadoSubida>,
  ): void {
    const target = tipo === 'ventas' ? this.ventas : tipo === 'categorias' ? this.categorias : this.metas;
    target.set({ ...target(), ...patch });
  }

  setArrastrando(tipo: 'ventas' | 'categorias' | 'metas', valor: boolean) {
    this.setEstado(tipo, { arrastrando: valor });
  }

  async ngOnInit() {
    await Promise.all([
      this.datasetService.listarAnios(),
      this.categoriasService.cargar(),
      this.metasService.cargarAnio(this.anioActual),
    ]);
    this.cargandoLista.set(false);
  }

  onFile(event: Event, tipo: 'ventas' | 'categorias' | 'metas') {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setEstado(tipo, { archivo: file, error: '' });
  }

  onDrop(event: DragEvent, tipo: 'ventas' | 'categorias' | 'metas') {
    event.preventDefault();
    this.setEstado(tipo, { arrastrando: false });
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setEstado(tipo, { archivo: file, error: '' });
  }

  // ----- Ventas -----
  async subirVentas() {
    const file = this.ventas().archivo;
    if (!file) return;
    this.setEstado('ventas', { error: '', subiendo: true, progreso: { fase: 'parseando', pct: 0, mensaje: 'Iniciando...' } });
    try {
      await this.datasetService.subir(file, Number(this.anioVentas), (p) =>
        this.setEstado('ventas', { progreso: p }),
      );
      this.setEstado('ventas', { archivo: null });
      setTimeout(() => this.setEstado('ventas', { progreso: null }), 2000);
    } catch (e) {
      this.setEstado('ventas', { error: (e as Error).message || 'Error al subir.', progreso: null });
    } finally {
      this.setEstado('ventas', { subiendo: false });
    }
  }

  async confirmarBorrarVentas(anio: number) {
    if (!confirm(`¿Eliminar el dataset de ventas del año ${anio}?`)) return;
    await this.datasetService.borrar(anio);
  }

  // ----- Categorías -----
  async subirCategorias() {
    const file = this.categorias().archivo;
    if (!file) return;
    this.setEstado('categorias', { error: '', subiendo: true, progreso: { fase: 'parseando', pct: 0, mensaje: 'Iniciando...' } });
    try {
      await this.categoriasService.subir(file, (p) => this.setEstado('categorias', { progreso: p }));
      this.setEstado('categorias', { archivo: null });
      setTimeout(() => this.setEstado('categorias', { progreso: null }), 2000);
    } catch (e) {
      this.setEstado('categorias', { error: (e as Error).message || 'Error al subir.', progreso: null });
    } finally {
      this.setEstado('categorias', { subiendo: false });
    }
  }

  async confirmarBorrarCategorias() {
    if (!confirm('¿Borrar todas las categorías de clientes?')) return;
    await this.categoriasService.borrarTodo();
  }

  // ----- Metas -----
  async subirMetas() {
    const file = this.metas().archivo;
    if (!file) return;
    this.setEstado('metas', { error: '', subiendo: true, progreso: { fase: 'parseando', pct: 0, mensaje: 'Iniciando...' } });
    try {
      await this.metasService.subir(file, Number(this.anioMetas), (p) =>
        this.setEstado('metas', { progreso: p }),
      );
      this.setEstado('metas', { archivo: null });
      setTimeout(() => this.setEstado('metas', { progreso: null }), 2000);
    } catch (e) {
      this.setEstado('metas', { error: (e as Error).message || 'Error al subir.', progreso: null });
    } finally {
      this.setEstado('metas', { subiendo: false });
    }
  }

  async confirmarBorrarMetas() {
    const anio = this.metasService.anioCargado();
    if (anio == null) return;
    if (!confirm(`¿Borrar las metas del año ${anio}?`)) return;
    await this.metasService.borrarAnio(anio);
  }
}
