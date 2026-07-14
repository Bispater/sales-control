import { Injectable, computed, signal } from '@angular/core';
import Papa from 'papaparse';
import {
  CAMPOS_NUMERICOS,
  COLUMNAS_CSV,
  DatasetInfo,
  ProgresoCarga,
  RegistroVenta,
} from '../models/dataset';
import { supabase } from '../supabase.config';

const TABLA = 'ventas';
const BATCH_SIZE = 1000;
const PAGE_SIZE = 1000;
const IDB_NAME = 'control-ventas-cache';
const IDB_STORE = 'datasets';

const CAMEL_TO_SNAKE: Record<keyof RegistroVenta, string> = {
  tipoMovimiento: 'tipo_movimiento',
  tipoDocumento: 'tipo_documento',
  numeroDocumento: 'numero_documento',
  fechaEmision: 'fecha_emision',
  trackingNumber: 'tracking_number',
  fechaHoraVenta: 'fecha_hora_venta',
  sucursal: 'sucursal',
  vendedor: 'vendedor',
  nombreCliente: 'nombre_cliente',
  clienteRut: 'cliente_rut',
  emailCliente: 'email_cliente',
  clienteDireccion: 'cliente_direccion',
  clienteComuna: 'cliente_comuna',
  clienteCiudad: 'cliente_ciudad',
  listaPrecio: 'lista_precio',
  tipoEntrega: 'tipo_entrega',
  moneda: 'moneda',
  tipoProducto: 'tipo_producto',
  sku: 'sku',
  producto: 'producto',
  variante: 'variante',
  otrosAtributos: 'otros_atributos',
  marca: 'marca',
  detallePack: 'detalle_pack',
  precioLista: 'precio_lista',
  precioNetoUnitario: 'precio_neto_unitario',
  precioBrutoUnitario: 'precio_bruto_unitario',
  cantidad: 'cantidad',
  ventaTotalNeta: 'venta_total_neta',
  totalImpuestos: 'total_impuestos',
  ventaTotalBruta: 'venta_total_bruta',
  nombreDescuento: 'nombre_descuento',
  descuentoNeto: 'descuento_neto',
  descuentoBruto: 'descuento_bruto',
  pctDescuento: 'pct_descuento',
  costoNetoUnitario: 'costo_neto_unitario',
  costoTotalNeto: 'costo_total_neto',
  margen: 'margen',
  pctMargen: 'pct_margen',
  anio: 'anio',
  mes: 'mes',
  dia: 'dia',
};

const SNAKE_TO_CAMEL: Record<string, keyof RegistroVenta> = Object.entries(
  CAMEL_TO_SNAKE,
).reduce(
  (acc, [camel, snake]) => {
    acc[snake] = camel as keyof RegistroVenta;
    return acc;
  },
  {} as Record<string, keyof RegistroVenta>,
);

@Injectable({ providedIn: 'root' })
export class DatasetService {
  anioActivo = signal<number | null>(null);
  aniosDisponibles = signal<DatasetInfo[]>([]);
  registros = signal<RegistroVenta[]>([]);
  cargando = signal(false);

  totalRegistros = computed(() => this.registros().length);

  private idbPromise: Promise<IDBDatabase> | null = null;

  async listarAnios(): Promise<DatasetInfo[]> {
    const { data, error } = await supabase.rpc('listar_anios_dataset');
    if (error) {
      console.error('listar_anios_dataset:', error);
      this.aniosDisponibles.set([]);
      return [];
    }
    const lista = (data as DatasetInfo[]) ?? [];
    this.aniosDisponibles.set(lista);
    return lista;
  }

  async cargarAnio(anio: number): Promise<void> {
    this.cargando.set(true);
    try {
      this.anioActivo.set(anio);

      const metaAnio = this.aniosDisponibles().find((a) => a.anio === anio);
      const version = metaAnio?.ultimaCarga ?? '';
      const desdeCache = version ? await this.leerCache(anio, version) : null;
      if (desdeCache) {
        this.registros.set(desdeCache);
        return;
      }

      const todos: RegistroVenta[] = [];
      let desde = 0;
      while (true) {
        const { data, error } = await supabase
          .from(TABLA)
          .select('*')
          .eq('anio', anio)
          .order('id', { ascending: true })
          .range(desde, desde + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const row of data as Record<string, unknown>[]) {
          todos.push(this.fromSnake(row));
        }
        if (data.length < PAGE_SIZE) break;
        desde += PAGE_SIZE;
      }
      this.registros.set(todos);
      if (version) await this.guardarCache(anio, version, todos);
    } finally {
      this.cargando.set(false);
    }
  }

  async subir(
    archivo: File,
    anio: number,
    onProgress: (p: ProgresoCarga) => void,
  ): Promise<void> {
    onProgress({ fase: 'parseando', pct: 0, mensaje: 'Leyendo archivo...' });
    const filas = await this.parsearCsv(archivo, anio, onProgress);

    // Seguridad: nunca borrar el año si el archivo no trajo filas válidas.
    if (filas.length === 0) {
      throw new Error(
        'El archivo no contiene filas válidas. No se modificó ningún dato del año ' + anio + '.',
      );
    }

    onProgress({
      fase: 'comprimiendo',
      pct: 0,
      totalFilas: filas.length,
      mensaje: `Preparando ${filas.length.toLocaleString('es-CL')} registros...`,
    });

    const { error: errDel } = await supabase.from(TABLA).delete().eq('anio', anio);
    if (errDel) throw errDel;

    await this.borrarCache(anio);

    const totalLotes = Math.ceil(filas.length / BATCH_SIZE);
    for (let i = 0; i < totalLotes; i++) {
      const lote = filas
        .slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
        .map((r) => this.toSnake(r));
      const { error } = await supabase.from(TABLA).insert(lote);
      if (error) throw error;
      const pct = Math.round(((i + 1) / totalLotes) * 100);
      onProgress({
        fase: 'subiendo',
        pct,
        chunkActual: i + 1,
        totalChunks: totalLotes,
        totalFilas: filas.length,
        mensaje: `Subiendo lote ${i + 1} de ${totalLotes}...`,
      });
    }

    await this.listarAnios();
    if (this.anioActivo() === anio) {
      this.registros.set(filas);
    } else {
      await this.cargarAnio(anio);
    }
    onProgress({ fase: 'completado', pct: 100, mensaje: '¡Carga finalizada!' });
  }

  async borrar(anio: number): Promise<void> {
    const { error } = await supabase.from(TABLA).delete().eq('anio', anio);
    if (error) throw error;
    await this.borrarCache(anio);
    await this.listarAnios();
    if (this.anioActivo() === anio) {
      this.registros.set([]);
      const siguiente = this.aniosDisponibles()[0]?.anio ?? null;
      this.anioActivo.set(siguiente);
      if (siguiente != null) await this.cargarAnio(siguiente);
    }
  }

  private parsearCsv(
    archivo: File,
    anioFallback: number,
    onProgress: (p: ProgresoCarga) => void,
  ): Promise<RegistroVenta[]> {
    return new Promise((resolve, reject) => {
      const filas: RegistroVenta[] = [];
      let procesadas = 0;
      const sizeBytes = archivo.size;

      Papa.parse<Record<string, string>>(archivo, {
        header: true,
        skipEmptyLines: true,
        chunkSize: 1024 * 512,
        worker: false,
        chunk: (results) => {
          for (const fila of results.data) {
            const r = this.normalizarFila(fila, anioFallback);
            if (r) filas.push(r);
          }
          procesadas += results.data.length;
          const bytesLeidos = (results.meta as { cursor?: number }).cursor ?? 0;
          const pct = Math.min(99, Math.round((bytesLeidos / sizeBytes) * 100));
          onProgress({
            fase: 'parseando',
            pct,
            filasProcesadas: procesadas,
            mensaje: `Leyendo CSV... ${procesadas.toLocaleString('es-CL')} filas`,
          });
        },
        complete: () => resolve(filas),
        error: (err) => reject(err),
      });
    });
  }

  private normalizarFila(
    fila: Record<string, string>,
    anioFallback: number,
  ): RegistroVenta | null {
    const r: Partial<RegistroVenta> = {};
    let tieneAlgo = false;
    for (const [colCsv, key] of Object.entries(COLUMNAS_CSV)) {
      const valor = fila[colCsv];
      if (valor === undefined || valor === null) {
        (r as Record<string, unknown>)[key] = CAMPOS_NUMERICOS.includes(key) ? 0 : '';
        continue;
      }
      if (CAMPOS_NUMERICOS.includes(key)) {
        (r as Record<string, unknown>)[key] = this.toNumber(valor);
      } else {
        const str = valor.toString().trim();
        (r as Record<string, unknown>)[key] = str;
        if (str.length > 0) tieneAlgo = true;
      }
    }
    const { anio, mes, dia } = this.derivarFecha(r.fechaEmision, r.fechaHoraVenta);
    r.anio = anio || anioFallback;
    r.mes = mes;
    r.dia = dia;
    return tieneAlgo ? (r as RegistroVenta) : null;
  }

  private derivarFecha(
    fechaEmision?: string,
    fechaHora?: string,
  ): { anio: number; mes: number; dia: number } {
    const candidatos = [fechaEmision, fechaHora].filter(Boolean) as string[];
    for (const s of candidatos) {
      const parsed = this.parseFecha(s);
      if (parsed) return parsed;
    }
    return { anio: 0, mes: 0, dia: 0 };
  }

  private parseFecha(s: string): { anio: number; mes: number; dia: number } | null {
    const txt = s.trim();
    if (!txt) return null;
    // Soporta yyyy-mm-dd, dd-mm-yyyy, dd/mm/yyyy, con o sin hora.
    const isoMatch = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return { anio: +isoMatch[1], mes: +isoMatch[2], dia: +isoMatch[3] };
    }
    const dmyMatch = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      return { anio: +dmyMatch[3], mes: +dmyMatch[2], dia: +dmyMatch[1] };
    }
    return null;
  }

  private toNumber(valor: string): number {
    if (typeof valor === 'number') return valor;
    if (valor === null || valor === undefined) return 0;
    let s = valor.toString().trim();
    if (!s) return 0;
    s = s.replace(/[%$€₡]/g, '').replace(/\s/g, '');
    if (!s || s === '-' || s === '.') return 0;

    const negativo = s.startsWith('-');
    if (negativo) s = s.slice(1);

    const hasDot = s.includes('.');
    const hasComma = s.includes(',');

    if (hasDot && hasComma) {
      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      if (lastComma > lastDot) {
        // Chileno/europeo: punto = miles, coma = decimal → "1.234,56" = 1234.56
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // US: coma = miles, punto = decimal → "1,234.56" = 1234.56
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      const partes = s.split(',');
      // Si TODOS los segmentos después de la primera coma tienen exactamente 3 dígitos
      // (ej. "12,920" o "1,234,567"), la coma es separador de miles, no decimal.
      const esMiles = partes.length > 1 && partes.slice(1).every((p) => /^\d{3}$/.test(p));
      if (esMiles) {
        s = partes.join('');
      } else {
        // Coma como decimal: "267,3" → 267.3
        s = s.replace(',', '.');
      }
    } else if (hasDot) {
      const partes = s.split('.');
      // Múltiples puntos → siempre separador de miles ("1.234.567" = 1234567).
      // Un solo punto se respeta como decimal (parseFloat lo maneja).
      if (partes.length > 2 && partes.slice(1).every((p) => /^\d{3}$/.test(p))) {
        s = partes.join('');
      }
    }

    const n = parseFloat(s);
    if (isNaN(n)) return 0;
    return negativo ? -n : n;
  }

  private toSnake(r: RegistroVenta): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(r) as (keyof RegistroVenta)[]) {
      out[CAMEL_TO_SNAKE[k]] = r[k];
    }
    return out;
  }

  private fromSnake(row: Record<string, unknown>): RegistroVenta {
    const out: Record<string, unknown> = {};
    for (const [snake, value] of Object.entries(row)) {
      const camel = SNAKE_TO_CAMEL[snake];
      if (!camel) continue;
      out[camel] = value;
    }
    return out as unknown as RegistroVenta;
  }

  private async getIdb(): Promise<IDBDatabase> {
    if (this.idbPromise) return this.idbPromise;
    this.idbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(IDB_STORE)) {
          idb.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.idbPromise;
  }

  private async leerCache(anio: number, version: string): Promise<RegistroVenta[] | null> {
    try {
      const idb = await this.getIdb();
      return new Promise((resolve) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(`year-${anio}`);
        req.onsuccess = () => {
          const v = req.result as { version: string; filas: RegistroVenta[] } | undefined;
          if (v && v.version === version) resolve(v.filas);
          else resolve(null);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  private async guardarCache(anio: number, version: string, filas: RegistroVenta[]): Promise<void> {
    try {
      const idb = await this.getIdb();
      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put({ version, filas }, `year-${anio}`);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // best effort
    }
  }

  private async borrarCache(anio: number): Promise<void> {
    try {
      const idb = await this.getIdb();
      await new Promise<void>((resolve) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(`year-${anio}`);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }
}
