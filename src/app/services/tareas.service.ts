import { Injectable, signal } from '@angular/core';
import Papa from 'papaparse';
import { supabase } from '../supabase.config';

export type TareaTipo = 'Producto Foco' | 'Ruta' | 'Venta Específica' | 'Otro';
export type TareaPrioridad = 'Alta' | 'Media' | 'Baja';
export type TareaEstado = 'Pendiente' | 'En Progreso' | 'Completada';

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: TareaTipo;
  prioridad: TareaPrioridad;
  vendedor: string;
  cliente?: string;
  fechaVencimiento: string; // YYYY-MM-DD
  estado: TareaEstado;
  fechaCompletada?: string; // YYYY-MM-DD
}

const TABLA = 'tareas';
const TIPOS: TareaTipo[] = ['Producto Foco', 'Ruta', 'Venta Específica', 'Otro'];

// Tareas compartidas con la app móvil vía la tabla `tareas` de Supabase.
@Injectable({ providedIn: 'root' })
export class TareasService {
  tareas = signal<Tarea[]>([]);
  cargando = signal(false);

  constructor() {
    this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const { data, error } = await supabase
        .from(TABLA)
        .select('id, titulo, descripcion, tipo, prioridad, vendedor, cliente, fecha_vencimiento, estado, fecha_completada')
        .order('created_at', { ascending: false });
      if (error) throw error;
      this.tareas.set((data ?? []).map((r) => this.desdeFila(r as Record<string, unknown>)));
    } catch (e) {
      // Silencioso: si la tabla no existe aún, se queda vacío.
      console.warn('cargar tareas:', e);
    } finally {
      this.cargando.set(false);
    }
  }

  private desdeFila(r: Record<string, unknown>): Tarea {
    return {
      id: String(r['id'] ?? ''),
      titulo: String(r['titulo'] ?? ''),
      descripcion: String(r['descripcion'] ?? ''),
      tipo: (r['tipo'] as TareaTipo) ?? 'Otro',
      prioridad: (r['prioridad'] as TareaPrioridad) ?? 'Media',
      vendedor: String(r['vendedor'] ?? ''),
      cliente: r['cliente'] ? String(r['cliente']) : '',
      fechaVencimiento: String(r['fecha_vencimiento'] ?? ''),
      estado: (r['estado'] as TareaEstado) ?? 'Pendiente',
      fechaCompletada: r['fecha_completada'] ? String(r['fecha_completada']) : undefined,
    };
  }

  private aFila(t: Tarea): Record<string, unknown> {
    return {
      id: t.id,
      titulo: t.titulo,
      descripcion: t.descripcion,
      tipo: t.tipo,
      prioridad: t.prioridad,
      vendedor: t.vendedor,
      cliente: t.cliente || null,
      fecha_vencimiento: t.fechaVencimiento || null,
      estado: t.estado,
      fecha_completada: t.fechaCompletada || null,
    };
  }

  private nuevoId(): string {
    return 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
  }

  private hoyISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async agregar(t: Omit<Tarea, 'id'>): Promise<void> {
    const tarea: Tarea = { ...t, id: this.nuevoId() };
    this.tareas.set([tarea, ...this.tareas()]); // optimista
    const { error } = await supabase.from(TABLA).insert(this.aFila(tarea));
    if (error) console.warn('agregar tarea:', error);
  }

  async actualizar(id: string, patch: Partial<Tarea>): Promise<void> {
    const actual = this.tareas().find((t) => t.id === id);
    if (!actual) return;
    const nueva = { ...actual, ...patch };
    this.tareas.set(this.tareas().map((t) => (t.id === id ? nueva : t)));
    const { error } = await supabase.from(TABLA).update(this.aFila(nueva)).eq('id', id);
    if (error) console.warn('actualizar tarea:', error);
  }

  async eliminar(id: string): Promise<void> {
    this.tareas.set(this.tareas().filter((t) => t.id !== id));
    const { error } = await supabase.from(TABLA).delete().eq('id', id);
    if (error) console.warn('eliminar tarea:', error);
  }

  // Click en el círculo: Pendiente → En Progreso → Completada → Pendiente.
  ciclarEstado(id: string): void {
    const orden: TareaEstado[] = ['Pendiente', 'En Progreso', 'Completada'];
    const t = this.tareas().find((x) => x.id === id);
    if (!t) return;
    const next = orden[(orden.indexOf(t.estado) + 1) % orden.length];
    this.actualizar(id, {
      estado: next,
      fechaCompletada: next === 'Completada' ? this.hoyISO() : undefined,
    });
  }

  // ---------- Carga masiva desde Excel/CSV ----------
  importarCsv(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        worker: false,
        complete: async (res) => {
          const col = this.detectarColumnas(res.meta.fields ?? []);
          if (!col.titulo) {
            reject(new Error('El archivo debe tener una columna "Título".'));
            return;
          }
          const nuevas: Tarea[] = [];
          for (const row of res.data) {
            const titulo = (row[col.titulo] ?? '').toString().trim();
            if (!titulo) continue;
            nuevas.push({
              id: this.nuevoId(),
              titulo,
              descripcion: col.descripcion ? (row[col.descripcion] ?? '').toString().trim() : '',
              tipo: this.normTipo(col.tipo ? row[col.tipo] : ''),
              prioridad: this.normPrioridad(col.prioridad ? row[col.prioridad] : ''),
              vendedor: col.vendedor ? (row[col.vendedor] ?? '').toString().trim() : '',
              cliente: col.cliente ? (row[col.cliente] ?? '').toString().trim() : '',
              fechaVencimiento: this.normFecha(col.fecha ? row[col.fecha] : ''),
              estado: 'Pendiente',
            });
          }
          try {
            if (nuevas.length > 0) {
              const { error } = await supabase.from(TABLA).insert(nuevas.map((t) => this.aFila(t)));
              if (error) throw error;
            }
            this.tareas.set([...nuevas, ...this.tareas()]);
            resolve(nuevas.length);
          } catch (e) {
            reject(e as Error);
          }
        },
        error: (e) => reject(e),
      });
    });
  }

  private detectarColumnas(fields: string[]): {
    titulo?: string; descripcion?: string; tipo?: string;
    prioridad?: string; vendedor?: string; cliente?: string; fecha?: string;
  } {
    const out: Record<string, string | undefined> = {};
    for (const f of fields) {
      const n = f.toLowerCase().trim();
      if (!out['titulo'] && /(t[ií]tulo|tarea|nombre)/.test(n)) out['titulo'] = f;
      else if (!out['descripcion'] && /(descrip)/.test(n)) out['descripcion'] = f;
      else if (!out['tipo'] && /tipo/.test(n)) out['tipo'] = f;
      else if (!out['prioridad'] && /priorid/.test(n)) out['prioridad'] = f;
      else if (!out['vendedor'] && /(vendedor|asignar|ejecutivo|responsable)/.test(n)) out['vendedor'] = f;
      else if (!out['cliente'] && /(cliente|raz[oó]n)/.test(n)) out['cliente'] = f;
      else if (!out['fecha'] && /(fecha|vencim|vence)/.test(n)) out['fecha'] = f;
    }
    return out as ReturnType<TareasService['detectarColumnas']>;
  }

  private normTipo(v: unknown): TareaTipo {
    const s = (v ?? '').toString().toLowerCase();
    if (/foco|producto/.test(s)) return 'Producto Foco';
    if (/ruta/.test(s)) return 'Ruta';
    if (/venta|espec/.test(s)) return 'Venta Específica';
    const exacto = TIPOS.find((t) => t.toLowerCase() === s.trim());
    return exacto ?? 'Otro';
  }

  private normPrioridad(v: unknown): TareaPrioridad {
    const s = (v ?? '').toString().toLowerCase();
    if (/alta|high|urgent/.test(s)) return 'Alta';
    if (/baja|low/.test(s)) return 'Baja';
    return 'Media';
  }

  private normFecha(v: unknown): string {
    const s = (v ?? '').toString().trim();
    if (!s) return '';
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return '';
  }
}
