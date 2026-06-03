import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MetaVendedor, ProgresoCarga } from '../../models/dataset';
import { CategoriasService } from '../../services/categorias.service';
import { DatasetService } from '../../services/dataset.service';
import { MetasService } from '../../services/metas.service';
import { TareasService } from '../../services/tareas.service';
import { colorPorNombre, iniciales } from '../../utils/colores';

type Tab = 'importar' | 'metas' | 'foco';
type TipoImport = 'ventas' | 'tareas' | 'clientes';

interface EstadoSubida {
  subiendo: boolean;
  progreso: ProgresoCarga | null;
  error: string;
  ok: string;
}

const estadoInicial: EstadoSubida = { subiendo: false, progreso: null, error: '', ok: '' };

const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const FOCO_STORAGE = 'control-ventas:productos-foco:v1';

@Component({
  selector: 'app-datos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Gestión de Datos</h1>
      <p class="text-sm text-slate-500 mt-1">Importar datos, configurar metas y productos foco</p>
    </div>

    <!-- ========== Tabs ========== -->
    <div class="bg-slate-100 rounded-xl p-1 flex flex-col sm:flex-row gap-1 mb-6">
      <button (click)="tab.set('importar')"
        class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition"
        [class.bg-white]="tab() === 'importar'" [class.shadow-sm]="tab() === 'importar'"
        [class.text-slate-900]="tab() === 'importar'" [class.text-slate-500]="tab() !== 'importar'">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
        Importar Datos
      </button>
      <button (click)="tab.set('metas')"
        class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition"
        [class.bg-white]="tab() === 'metas'" [class.shadow-sm]="tab() === 'metas'"
        [class.text-slate-900]="tab() === 'metas'" [class.text-slate-500]="tab() !== 'metas'">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
        Metas Mensuales
      </button>
      <button (click)="tab.set('foco')"
        class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition"
        [class.bg-white]="tab() === 'foco'" [class.shadow-sm]="tab() === 'foco'"
        [class.text-slate-900]="tab() === 'foco'" [class.text-slate-500]="tab() !== 'foco'">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg>
        Productos Foco
      </button>
    </div>

    <!-- ============================================================= -->
    <!-- ==================== TAB: IMPORTAR DATOS ===================== -->
    <!-- ============================================================= -->
    <div *ngIf="tab() === 'importar'" class="bg-white rounded-xl shadow-card border border-slate-100 p-6">
      <h2 class="text-base font-semibold text-slate-900 mb-5">Importar Datos desde Excel</h2>

      <!-- Importar Ventas -->
      <div class="rounded-xl border border-sky-100 bg-sky-50/50 p-5 mb-4">
        <div class="flex items-start gap-3">
          <span class="text-sky-600 shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="text-base font-semibold text-slate-900">Importar Datos de Ventas</h3>
            <p class="text-sm text-slate-600 mt-1">Importa datos de ventas desde un archivo CSV. El archivo debe contener las columnas de tu exportación (Fecha, Cliente, Producto, Vendedor, Monto, etc.).</p>
            <div class="flex flex-wrap items-end gap-3 mt-3">
              <div>
                <label class="block text-[11px] text-slate-500 mb-1">Año del dataset</label>
                <select [(ngModel)]="anioVentas" [disabled]="estado('ventas').subiendo"
                        class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  <option *ngFor="let a of aniosOpciones" [value]="a">{{ a }}</option>
                </select>
              </div>
              <label class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg cursor-pointer transition"
                     [class.opacity-60]="estado('ventas').subiendo" [class.pointer-events-none]="estado('ventas').subiendo">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                {{ estado('ventas').subiendo ? 'Importando...' : 'Importar Ventas' }}
                <input type="file" accept=".csv,text/csv" class="hidden" (change)="onImport('ventas', $event)" [disabled]="estado('ventas').subiendo" />
              </label>
              <span class="text-xs text-slate-500">{{ datasetService.aniosDisponibles().length }} año(s) cargado(s)</span>
            </div>
            <ng-container *ngTemplateOutlet="feedback; context: { $implicit: 'ventas' }"></ng-container>
          </div>
        </div>
      </div>

      <!-- Importar Tareas -->
      <div class="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5 mb-4">
        <div class="flex items-start gap-3">
          <span class="text-emerald-600 shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="text-base font-semibold text-slate-900">Importar Tareas</h3>
            <p class="text-sm text-slate-600 mt-1">Importa tareas desde un archivo CSV. El archivo debe contener: Título, Descripción, Tipo, Vendedor, Prioridad, Fecha de Vencimiento.</p>
            <div class="flex flex-wrap items-center gap-3 mt-3">
              <label class="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-medium px-4 py-2.5 rounded-lg cursor-pointer transition">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                Importar Tareas
                <input type="file" accept=".csv,text/csv" class="hidden" (change)="onImport('tareas', $event)" />
              </label>
              <span class="text-xs text-slate-500">{{ tareasService.tareas().length | number }} tareas · se ven en la pestaña Tareas</span>
            </div>
            <ng-container *ngTemplateOutlet="feedback; context: { $implicit: 'tareas' }"></ng-container>
          </div>
        </div>
      </div>

      <!-- Importar Clientes -->
      <div class="rounded-xl border border-violet-100 bg-violet-50/40 p-5">
        <div class="flex items-start gap-3">
          <span class="text-violet-600 shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="text-base font-semibold text-slate-900">Importar Clientes</h3>
            <p class="text-sm text-slate-600 mt-1">Importa categorías/canal de clientes desde CSV con columnas <code>rut</code>, <code>nombre</code> (opcional) y <code>categoria</code> (HOLDING / TRABAJADORES / TERCEROS).</p>
            <div class="flex flex-wrap items-center gap-3 mt-3">
              <label class="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-medium px-4 py-2.5 rounded-lg cursor-pointer transition"
                     [class.opacity-60]="estado('clientes').subiendo" [class.pointer-events-none]="estado('clientes').subiendo">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                {{ estado('clientes').subiendo ? 'Importando...' : 'Importar Clientes' }}
                <input type="file" accept=".csv,text/csv" class="hidden" (change)="onImport('clientes', $event)" [disabled]="estado('clientes').subiendo" />
              </label>
              <span class="text-xs text-slate-500">{{ categoriasService.totalCargados() | number }} clientes mapeados</span>
              <button *ngIf="categoriasService.totalCargados() > 0" (click)="borrarClientes()"
                      class="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded">Borrar todo</button>
            </div>
            <ng-container *ngTemplateOutlet="feedback; context: { $implicit: 'clientes' }"></ng-container>
          </div>
        </div>
      </div>

      <div class="border-t border-slate-100 mt-6 pt-4">
        <p class="text-sm font-semibold text-slate-900 mb-2">Notas Importantes:</p>
        <ul class="text-xs text-slate-500 space-y-1 list-disc pl-5">
          <li>Los archivos deben estar en formato .xlsx o .csv</li>
          <li>La primera fila debe contener los nombres de las columnas</li>
          <li>Asegúrate de que los nombres de vendedores coincidan con los registrados en el sistema</li>
          <li>Las fechas deben estar en formato DD/MM/AAAA</li>
          <li>Los montos no deben incluir símbolos de moneda</li>
        </ul>
      </div>
    </div>

    <!-- ============================================================= -->
    <!-- ==================== TAB: METAS MENSUALES =================== -->
    <!-- ============================================================= -->
    <div *ngIf="tab() === 'metas'" class="bg-white rounded-xl shadow-card border border-slate-100 p-6">
      <div class="flex items-center justify-between gap-3 mb-5">
        <h2 class="text-base font-semibold text-slate-900">Configuración de Metas Mensuales</h2>
        <select [ngModel]="anioMetas()" (ngModelChange)="cambiarAnioMetas(+$event)"
                class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option *ngFor="let a of aniosOpciones" [value]="a">{{ a }}</option>
        </select>
      </div>

      <div *ngIf="vendedoresGrid().length === 0" class="text-sm text-slate-400 py-8 text-center">
        No hay vendedores. Importa primero un dataset de ventas para poblar la grilla.
      </div>

      <div *ngIf="vendedoresGrid().length > 0" class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-slate-200">
              <th class="text-left px-3 py-3 text-xs font-semibold text-slate-600 sticky left-0 bg-white min-w-[150px]">Vendedor</th>
              <th *ngFor="let m of mesesLargo" class="text-center px-2 py-3 text-xs font-semibold text-slate-600 min-w-[90px]">{{ m }}</th>
              <th class="text-center px-3 py-3 text-xs font-semibold text-slate-600 bg-sky-50 min-w-[90px]">Total Año</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let v of vendedoresGrid()" class="border-b border-slate-100">
              <td class="px-3 py-3 sticky left-0 bg-white">
                <div class="flex items-center gap-2">
                  <span class="w-7 h-7 inline-flex items-center justify-center rounded-full text-white text-[10px] font-bold shrink-0" [style.backgroundColor]="color(v)">{{ inic(v) }}</span>
                  <span class="text-sm font-medium text-slate-800">{{ v }}</span>
                </div>
              </td>
              <td *ngFor="let m of mesesLargo; let i = index" class="px-1.5 py-2">
                <input type="number" min="0" [ngModel]="valorMeta(v, i)" (ngModelChange)="setMeta(v, i, $event)"
                       class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white" />
              </td>
              <td class="px-3 py-2 text-right text-sm font-bold text-slate-900 bg-sky-50/60 whitespace-nowrap">{{ formatoCLP(totalAnioVendedor(v)) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-slate-200">
              <td class="px-3 py-3 text-sm font-semibold text-slate-700 sticky left-0 bg-white">Total por Mes</td>
              <td *ngFor="let m of mesesLargo; let i = index" class="px-2 py-3 text-center text-sm font-semibold text-slate-700 whitespace-nowrap">{{ formatoCLP(totalMes(i)) }}</td>
              <td class="px-3 py-3 text-right text-sm font-bold text-slate-900 bg-sky-50 whitespace-nowrap">{{ formatoCLP(totalGeneral()) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="flex items-center justify-end gap-2 mt-5">
        <span *ngIf="metasGuardado()" class="text-xs text-emerald-600">{{ metasGuardado() }}</span>
        <button (click)="guardarMetas()" [disabled]="guardandoMetas() || vendedoresGrid().length === 0"
                class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3h9.75A2.25 2.25 0 0 1 19.5 5.25v13.5A2.25 2.25 0 0 1 17.25 21H6.75A2.25 2.25 0 0 1 4.5 18.75V9M3 7.5V18.75A2.25 2.25 0 0 0 5.25 21M3 7.5h2.25M15 3.75v3a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 9 6.75v-3"/></svg>
          {{ guardandoMetas() ? 'Guardando...' : 'Guardar Metas' }}
        </button>
      </div>

      <div class="bg-sky-50/60 border border-sky-100 rounded-xl p-4 mt-6">
        <p class="text-sm font-semibold text-slate-800 mb-2">Instrucciones:</p>
        <ul class="text-xs text-sky-800/80 space-y-1 list-disc pl-5">
          <li>Ingresa el valor de la meta para cada vendedor en cada mes</li>
          <li>Los valores se calculan automáticamente en los totales</li>
          <li>Puedes cambiar el año usando el selector superior</li>
          <li>No olvides hacer clic en "Guardar Metas" para aplicar los cambios</li>
        </ul>
      </div>
    </div>

    <!-- ============================================================= -->
    <!-- ==================== TAB: PRODUCTOS FOCO ==================== -->
    <!-- ============================================================= -->
    <div *ngIf="tab() === 'foco'" class="bg-white rounded-xl shadow-card border border-slate-100 p-6">
      <h2 class="text-base font-semibold text-slate-900 mb-5">Configuración de Productos Foco</h2>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Mes</label>
          <select [ngModel]="mesFoco()" (ngModelChange)="mesFoco.set(+$event)"
                  class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
            <option *ngFor="let m of mesesLargo; let i = index" [value]="i + 1">{{ m }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Año</label>
          <select [ngModel]="anioFoco()" (ngModelChange)="anioFoco.set(+$event)"
                  class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
            <option *ngFor="let a of aniosOpciones" [value]="a">{{ a }}</option>
          </select>
        </div>
      </div>

      <p class="text-sm font-semibold text-slate-900 mb-2">Productos Foco - {{ mesesLargo[mesFoco() - 1] }} {{ anioFoco() }}</p>
      <div class="flex flex-wrap gap-2 mb-5 min-h-[2.5rem]">
        <span *ngFor="let p of focoDelMes()" class="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg>
          {{ p }}
          <button (click)="quitarFoco(p)" class="hover:text-rose-300"><svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button>
        </span>
        <span *ngIf="focoDelMes().length === 0" class="text-sm text-slate-400 self-center">Sin productos foco para este mes.</span>
      </div>

      <p class="text-sm font-semibold text-slate-900 mb-2">Buscar y Agregar Productos</p>
      <div class="relative mb-2">
        <span class="absolute inset-y-0 left-3 flex items-center text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
        </span>
        <input [ngModel]="busquedaFoco()" (ngModelChange)="busquedaFoco.set($event)"
               (focus)="focoAbierto.set(true)" (blur)="cerrarPanelFoco()"
               placeholder="Buscar producto por nombre... (clic para ver todos)"
               class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white" />
      </div>
      <div *ngIf="focoAbierto() || busquedaFoco().trim()" class="border border-slate-100 rounded-lg divide-y divide-slate-50 max-h-72 overflow-y-auto mb-5">
        <div class="px-3 py-1.5 text-[11px] text-slate-400 bg-slate-50 sticky top-0">
          {{ busquedaFoco().trim() ? (sugerenciasFoco().length + ' coincidencia(s)') : ('Todos los productos (' + sugerenciasFoco().length + ')') }}
        </div>
        <button *ngFor="let p of sugerenciasFoco()" (mousedown)="$event.preventDefault(); agregarFoco(p)"
                class="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
          <span class="truncate">{{ p }}</span>
          <span class="inline-flex items-center gap-1 text-xs text-brand-600 font-medium shrink-0 ml-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Agregar
          </span>
        </button>
        <p *ngIf="sugerenciasFoco().length === 0" class="px-3 py-3 text-sm text-slate-400">
          {{ productosOpciones().length === 0 ? 'No hay productos cargados. Importa un dataset de ventas.' : 'Sin coincidencias.' }}
        </p>
      </div>

      <div class="border-t border-slate-100 pt-5">
        <p class="text-sm font-semibold text-slate-900 mb-3">Resumen del Año {{ anioFoco() }}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div *ngFor="let m of mesesLargo; let i = index"
               class="border rounded-xl p-4 cursor-pointer transition"
               [class.border-brand-300]="mesFoco() === i + 1"
               [class.ring-2]="mesFoco() === i + 1"
               [class.ring-brand-100]="mesFoco() === i + 1"
               [class.border-slate-100]="mesFoco() !== i + 1"
               (click)="mesFoco.set(i + 1)">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-semibold text-slate-900">{{ m }}</span>
              <span class="text-[11px] font-medium px-2 py-0.5 rounded-full"
                    [class.bg-slate-900]="focoDe(i + 1).length > 0"
                    [class.text-white]="focoDe(i + 1).length > 0"
                    [class.bg-slate-100]="focoDe(i + 1).length === 0"
                    [class.text-slate-500]="focoDe(i + 1).length === 0">
                {{ focoDe(i + 1).length }} productos
              </span>
            </div>
            <p *ngFor="let p of focoDe(i + 1)" class="text-xs text-slate-500 truncate">• {{ p }}</p>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 mt-6">
        <span *ngIf="focoGuardado()" class="text-xs text-emerald-600">{{ focoGuardado() }}</span>
        <button (click)="guardarFoco()"
                class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3h9.75A2.25 2.25 0 0 1 19.5 5.25v13.5A2.25 2.25 0 0 1 17.25 21H6.75A2.25 2.25 0 0 1 4.5 18.75V9M3 7.5V18.75A2.25 2.25 0 0 0 5.25 21M3 7.5h2.25M15 3.75v3a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 9 6.75v-3"/></svg>
          Guardar Configuración
        </button>
      </div>

      <div class="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 mt-6">
        <p class="text-sm font-semibold text-slate-800 mb-2">Instrucciones:</p>
        <ul class="text-xs text-emerald-800/80 space-y-1 list-disc pl-5">
          <li>Selecciona el mes y año para configurar los productos foco</li>
          <li>Busca productos por nombre en el buscador</li>
          <li>Haz clic en "Agregar" para añadir un producto como foco del mes</li>
          <li>Puedes agregar múltiples productos foco por mes</li>
          <li>La configuración se guarda en este navegador (localStorage).</li>
        </ul>
      </div>
    </div>

    <!-- ========== Feedback reutilizable ========== -->
    <ng-template #feedback let-tipo>
      <div *ngIf="estado(tipo).error" class="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3 mt-3">
        {{ estado(tipo).error }}
      </div>
      <div *ngIf="estado(tipo).ok" class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3 mt-3">
        {{ estado(tipo).ok }}
      </div>
      <div *ngIf="estado(tipo).progreso as p" class="bg-slate-50 border border-slate-100 rounded-lg p-3 mt-3">
        <div class="flex items-center justify-between mb-1 text-sm">
          <span class="font-medium text-slate-700">{{ p.mensaje }}</span>
          <span class="text-slate-500">{{ p.pct }}%</span>
        </div>
        <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div class="h-full bg-brand-600 transition-all duration-200" [style.width.%]="p.pct"></div>
        </div>
      </div>
    </ng-template>
  `,
})
export class DatosComponent implements OnInit {
  datasetService = inject(DatasetService);
  categoriasService = inject(CategoriasService);
  metasService = inject(MetasService);
  tareasService = inject(TareasService);

  tab = signal<Tab>('importar');

  mesesLargo = MESES_LARGO;
  anioActual = new Date().getFullYear();
  aniosOpciones = Array.from({ length: 6 }, (_, i) => this.anioActual - i + 1).reverse();
  anioVentas = this.anioActual;

  // ---------- Estado de importaciones ----------
  private estados: Record<TipoImport, ReturnType<typeof signal<EstadoSubida>>> = {
    ventas: signal<EstadoSubida>({ ...estadoInicial }),
    tareas: signal<EstadoSubida>({ ...estadoInicial }),
    clientes: signal<EstadoSubida>({ ...estadoInicial }),
  };
  estado(tipo: TipoImport): EstadoSubida { return this.estados[tipo](); }
  private setEstado(tipo: TipoImport, patch: Partial<EstadoSubida>): void {
    this.estados[tipo].set({ ...this.estados[tipo](), ...patch });
  }

  // ---------- Metas (grilla editable) ----------
  anioMetas = signal<number>(this.anioActual);
  grid = signal<Record<string, number[]>>({});
  guardandoMetas = signal(false);
  metasGuardado = signal('');

  vendedoresGrid = computed<string[]>(() => {
    const set = new Set<string>();
    for (const r of this.datasetService.registros()) {
      const v = (r.vendedor || '').trim();
      if (v) set.add(v);
    }
    for (const m of this.metasService.metas()) {
      const v = (m.vendedor || '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort();
  });

  // ---------- Productos foco ----------
  mesFoco = signal<number>(new Date().getMonth() + 1);
  anioFoco = signal<number>(this.anioActual);
  busquedaFoco = signal('');
  focoAbierto = signal(false);
  focoData = signal<Record<string, string[]>>({}); // clave "anio-mes" -> productos
  focoGuardado = signal('');

  productosOpciones = computed<string[]>(() => {
    const set = new Set<string>();
    for (const r of this.datasetService.registros()) {
      const p = (r.producto || '').trim();
      if (p) set.add(p);
    }
    return Array.from(set).sort();
  });

  focoDelMes = computed<string[]>(() => this.focoDe(this.mesFoco()));

  // Sin texto: muestra TODOS los productos (que no sean ya foco del mes).
  // Con texto: filtra por coincidencia.
  sugerenciasFoco = computed<string[]>(() => {
    const t = this.busquedaFoco().toLowerCase().trim();
    const yaFoco = new Set(this.focoDelMes());
    const base = this.productosOpciones().filter((p) => !yaFoco.has(p));
    return t ? base.filter((p) => p.toLowerCase().includes(t)) : base;
  });

  async ngOnInit() {
    await Promise.all([
      this.datasetService.listarAnios(),
      this.categoriasService.cargar(),
      this.metasService.cargarAnio(this.anioMetas()),
    ]);
    // Carga registros del año activo (o el más reciente) para poblar vendedores/productos.
    if (this.datasetService.registros().length === 0) {
      const anio = this.datasetService.anioActivo() ?? this.datasetService.aniosDisponibles()[0]?.anio;
      if (anio != null) await this.datasetService.cargarAnio(anio);
    }
    this.reconstruirGrid();
    this.cargarFocoLocal();
  }

  // ============ Importaciones ============
  async onImport(tipo: TipoImport, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.setEstado(tipo, { error: '', ok: '', subiendo: true, progreso: { fase: 'parseando', pct: 0, mensaje: 'Leyendo archivo...' } });
    try {
      if (tipo === 'ventas') {
        await this.datasetService.subir(file, Number(this.anioVentas), (p) => this.setEstado('ventas', { progreso: p }));
        this.reconstruirGrid();
      } else if (tipo === 'clientes') {
        await this.categoriasService.subir(file, (p) => this.setEstado('clientes', { progreso: p }));
      } else {
        await this.importarTareasLocal(file);
      }
      this.setEstado(tipo, { ok: '¡Importación completada!' });
      setTimeout(() => this.setEstado(tipo, { progreso: null, ok: '' }), 2500);
    } catch (e) {
      this.setEstado(tipo, { error: (e as Error).message || 'Error al importar.', progreso: null });
    } finally {
      this.setEstado(tipo, { subiendo: false });
    }
  }

  private async importarTareasLocal(file: File): Promise<void> {
    const n = await this.tareasService.importarCsv(file);
    this.setEstado('tareas', { progreso: { fase: 'completado', pct: 100, mensaje: `${n} tareas importadas.` } });
  }

  async borrarClientes(): Promise<void> {
    if (!confirm('¿Borrar todas las categorías/canal de clientes?')) return;
    await this.categoriasService.borrarTodo();
  }

  // ============ Metas ============
  private reconstruirGrid(): void {
    const vendedores = this.vendedoresGrid();
    const metas = this.metasService.metas();
    const g: Record<string, number[]> = {};
    for (const v of vendedores) g[v] = Array(12).fill(0);
    for (const m of metas) {
      const v = (m.vendedor || '').trim();
      if (!g[v]) g[v] = Array(12).fill(0);
      if (m.mes >= 1 && m.mes <= 12) g[v][m.mes - 1] = m.metaClp;
    }
    this.grid.set(g);
  }

  async cambiarAnioMetas(anio: number): Promise<void> {
    this.anioMetas.set(anio);
    this.metasGuardado.set('');
    await this.metasService.cargarAnio(anio);
    this.reconstruirGrid();
  }

  valorMeta(v: string, mesIdx: number): number {
    return this.grid()[v]?.[mesIdx] ?? 0;
  }
  setMeta(v: string, mesIdx: number, valor: unknown): void {
    const n = Math.max(0, Number(valor) || 0);
    const g = { ...this.grid() };
    const fila = [...(g[v] ?? Array(12).fill(0))];
    fila[mesIdx] = n;
    g[v] = fila;
    this.grid.set(g);
    this.metasGuardado.set('');
  }
  totalAnioVendedor(v: string): number {
    return (this.grid()[v] ?? []).reduce((a, b) => a + b, 0);
  }
  totalMes(mesIdx: number): number {
    let t = 0;
    const g = this.grid();
    for (const v of Object.keys(g)) t += g[v][mesIdx] ?? 0;
    return t;
  }
  totalGeneral(): number {
    let t = 0;
    const g = this.grid();
    for (const v of Object.keys(g)) t += g[v].reduce((a, b) => a + b, 0);
    return t;
  }

  async guardarMetas(): Promise<void> {
    this.guardandoMetas.set(true);
    this.metasGuardado.set('');
    try {
      const anio = this.anioMetas();
      const g = this.grid();
      const lista: MetaVendedor[] = [];
      for (const v of Object.keys(g)) {
        for (let i = 0; i < 12; i++) {
          const val = g[v][i] ?? 0;
          if (val > 0) lista.push({ vendedor: v, anio, mes: i + 1, metaClp: val, categoria: '' });
        }
      }
      await this.metasService.guardarAnio(anio, lista);
      this.metasGuardado.set('✓ Metas guardadas');
      setTimeout(() => this.metasGuardado.set(''), 3000);
    } catch (e) {
      this.metasGuardado.set('Error: ' + ((e as Error).message || 'no se pudo guardar'));
    } finally {
      this.guardandoMetas.set(false);
    }
  }

  // ============ Productos foco ============
  private claveFoco(mes: number, anio = this.anioFoco()): string { return `${anio}-${mes}`; }

  focoDe(mes: number): string[] {
    return this.focoData()[this.claveFoco(mes)] ?? [];
  }

  cerrarPanelFoco(): void {
    // Pequeño delay para que un clic en una sugerencia se registre antes de cerrar.
    setTimeout(() => this.focoAbierto.set(false), 150);
  }

  agregarFoco(producto: string): void {
    const clave = this.claveFoco(this.mesFoco());
    const data = { ...this.focoData() };
    const actuales = data[clave] ?? [];
    if (!actuales.includes(producto)) data[clave] = [...actuales, producto];
    this.focoData.set(data);
    this.busquedaFoco.set('');
    this.focoGuardado.set('');
  }
  quitarFoco(producto: string): void {
    const clave = this.claveFoco(this.mesFoco());
    const data = { ...this.focoData() };
    data[clave] = (data[clave] ?? []).filter((p) => p !== producto);
    this.focoData.set(data);
    this.focoGuardado.set('');
  }

  private cargarFocoLocal(): void {
    try {
      const raw = localStorage.getItem(FOCO_STORAGE);
      if (raw) this.focoData.set(JSON.parse(raw));
    } catch {
      // ignore
    }
  }
  guardarFoco(): void {
    try {
      localStorage.setItem(FOCO_STORAGE, JSON.stringify(this.focoData()));
      this.focoGuardado.set('✓ Configuración guardada');
      setTimeout(() => this.focoGuardado.set(''), 3000);
    } catch {
      this.focoGuardado.set('No se pudo guardar en este navegador.');
    }
  }

  // ============ Helpers ============
  formatoCLP(n: number): string {
    return '$' + (Math.round(n) || 0).toLocaleString('es-CL');
  }
  color(n: string): string { return colorPorNombre(n); }
  inic(n: string): string { return iniciales(n); }
}
