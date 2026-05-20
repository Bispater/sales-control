import { Injectable, signal } from '@angular/core';
import Papa from 'papaparse';
import { ClienteCategoria, ProgresoCarga } from '../models/dataset';
import { supabase } from '../supabase.config';

const TABLA = 'clientes_categoria';
const BATCH_SIZE = 1000;

@Injectable({ providedIn: 'root' })
export class CategoriasService {
  mapaPorRut = signal<Map<string, ClienteCategoria>>(new Map());
  totalCargados = signal<number>(0);
  ultimaCarga = signal<string | null>(null);
  cargando = signal(false);

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const map = new Map<string, ClienteCategoria>();
      let desde = 0;
      const page = 1000;
      let ultima = '';
      while (true) {
        const { data, error } = await supabase
          .from(TABLA)
          .select('rut, nombre, categoria, created_at')
          .order('rut', { ascending: true })
          .range(desde, desde + page - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const row of data as { rut: string; nombre: string; categoria: string; created_at?: string }[]) {
          map.set(this.normalizarRut(row.rut), {
            rut: row.rut,
            nombre: row.nombre ?? '',
            categoria: row.categoria,
          });
          if (row.created_at && row.created_at > ultima) ultima = row.created_at;
        }
        if (data.length < page) break;
        desde += page;
      }
      this.mapaPorRut.set(map);
      this.totalCargados.set(map.size);
      this.ultimaCarga.set(ultima || null);
    } finally {
      this.cargando.set(false);
    }
  }

  async subir(archivo: File, onProgress: (p: ProgresoCarga) => void): Promise<void> {
    onProgress({ fase: 'parseando', pct: 0, mensaje: 'Leyendo archivo...' });
    const filas = await this.parsearCsv(archivo, onProgress);
    if (filas.length === 0) {
      onProgress({ fase: 'completado', pct: 100, mensaje: 'Archivo sin filas válidas.' });
      return;
    }

    onProgress({
      fase: 'comprimiendo',
      pct: 0,
      totalFilas: filas.length,
      mensaje: `Subiendo ${filas.length.toLocaleString('es-CL')} clientes...`,
    });

    const totalLotes = Math.ceil(filas.length / BATCH_SIZE);
    for (let i = 0; i < totalLotes; i++) {
      const lote = filas.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE).map((c) => ({
        rut: c.rut,
        nombre: c.nombre,
        categoria: c.categoria,
      }));
      const { error } = await supabase.from(TABLA).upsert(lote, { onConflict: 'rut' });
      if (error) throw error;
      const pct = Math.round(((i + 1) / totalLotes) * 100);
      onProgress({
        fase: 'subiendo',
        pct,
        chunkActual: i + 1,
        totalChunks: totalLotes,
        totalFilas: filas.length,
        mensaje: `Lote ${i + 1} de ${totalLotes}...`,
      });
    }

    await this.cargar();
    onProgress({ fase: 'completado', pct: 100, mensaje: '¡Carga finalizada!' });
  }

  async borrarTodo(): Promise<void> {
    const { error } = await supabase.from(TABLA).delete().neq('rut', '__sentinela_nunca_existe__');
    if (error) throw error;
    this.mapaPorRut.set(new Map());
    this.totalCargados.set(0);
    this.ultimaCarga.set(null);
  }

  categoriaDeRut(rut: string | null | undefined): string | null {
    if (!rut) return null;
    return this.mapaPorRut().get(this.normalizarRut(rut))?.categoria ?? null;
  }

  private normalizarRut(rut: string): string {
    return rut.trim().toUpperCase().replace(/\./g, '');
  }

  private parsearCsv(
    archivo: File,
    onProgress: (p: ProgresoCarga) => void,
  ): Promise<ClienteCategoria[]> {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(archivo, {
        header: true,
        skipEmptyLines: true,
        worker: false,
        complete: (results) => {
          const filas: ClienteCategoria[] = [];
          const headerMap = this.detectarColumnas(results.meta.fields ?? []);
          if (!headerMap.rut || !headerMap.categoria) {
            reject(
              new Error(
                'El archivo debe tener columnas "rut" y "categoria" (y opcionalmente "nombre").',
              ),
            );
            return;
          }
          for (const row of results.data) {
            const rut = row[headerMap.rut]?.toString().trim();
            const categoria = row[headerMap.categoria]?.toString().trim();
            if (!rut || !categoria) continue;
            filas.push({
              rut: this.normalizarRut(rut),
              nombre: (headerMap.nombre ? row[headerMap.nombre] : '')?.toString().trim() ?? '',
              categoria: categoria.toUpperCase(),
            });
          }
          // Dedup por RUT — gana la última aparición.
          const map = new Map<string, ClienteCategoria>();
          for (const f of filas) map.set(f.rut, f);
          onProgress({
            fase: 'parseando',
            pct: 100,
            filasProcesadas: filas.length,
            mensaje: `Detectados ${map.size.toLocaleString('es-CL')} clientes únicos.`,
          });
          resolve(Array.from(map.values()));
        },
        error: (err) => reject(err),
      });
    });
  }

  private detectarColumnas(fields: string[]): { rut?: string; nombre?: string; categoria?: string } {
    const result: { rut?: string; nombre?: string; categoria?: string } = {};
    for (const f of fields) {
      const norm = f.toLowerCase().trim();
      if (!result.rut && /(^|\s)rut/.test(norm)) result.rut = f;
      else if (!result.nombre && /(nombre|cliente)/.test(norm)) result.nombre = f;
      else if (!result.categoria && /(categor)/.test(norm)) result.categoria = f;
    }
    return result;
  }
}
