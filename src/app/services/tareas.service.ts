import { Injectable, signal } from '@angular/core';
import Papa from 'papaparse';

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
  fechaVencimiento: string; // YYYY-MM-DD
  estado: TareaEstado;
  fechaCompletada?: string; // YYYY-MM-DD
}

const STORAGE = 'control-ventas:tareas:v1';
const TIPOS: TareaTipo[] = ['Producto Foco', 'Ruta', 'Venta Específica', 'Otro'];

// Las tareas no tienen aún tabla en Supabase; se persisten en el navegador.
@Injectable({ providedIn: 'root' })
export class TareasService {
  tareas = signal<Tarea[]>([]);

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) this.tareas.set(JSON.parse(raw));
    } catch {
      // ignore
    }
  }

  private persistir(): void {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(this.tareas()));
    } catch {
      // ignore
    }
  }

  private nuevoId(): string {
    return 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
  }

  private hoyISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  agregar(t: Omit<Tarea, 'id'>): void {
    this.tareas.set([{ ...t, id: this.nuevoId() }, ...this.tareas()]);
    this.persistir();
  }

  actualizar(id: string, patch: Partial<Tarea>): void {
    this.tareas.set(this.tareas().map((t) => (t.id === id ? { ...t, ...patch } : t)));
    this.persistir();
  }

  eliminar(id: string): void {
    this.tareas.set(this.tareas().filter((t) => t.id !== id));
    this.persistir();
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
        complete: (res) => {
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
              fechaVencimiento: this.normFecha(col.fecha ? row[col.fecha] : ''),
              estado: 'Pendiente',
            });
          }
          this.tareas.set([...nuevas, ...this.tareas()]);
          this.persistir();
          resolve(nuevas.length);
        },
        error: (e) => reject(e),
      });
    });
  }

  private detectarColumnas(fields: string[]): {
    titulo?: string; descripcion?: string; tipo?: string;
    prioridad?: string; vendedor?: string; fecha?: string;
  } {
    const out: Record<string, string | undefined> = {};
    for (const f of fields) {
      const n = f.toLowerCase().trim();
      if (!out['titulo'] && /(t[ií]tulo|tarea|nombre)/.test(n)) out['titulo'] = f;
      else if (!out['descripcion'] && /(descrip)/.test(n)) out['descripcion'] = f;
      else if (!out['tipo'] && /tipo/.test(n)) out['tipo'] = f;
      else if (!out['prioridad'] && /priorid/.test(n)) out['prioridad'] = f;
      else if (!out['vendedor'] && /(vendedor|asignar|ejecutivo|responsable)/.test(n)) out['vendedor'] = f;
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
