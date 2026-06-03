import { Injectable, signal } from '@angular/core';
import Papa from 'papaparse';
import { MESES_CSV, MetaVendedor, ProgresoCarga } from '../models/dataset';
import { supabase } from '../supabase.config';
import { toNumber } from '../utils/numero';

const TABLA = 'metas_vendedor';
const BATCH_SIZE = 500;

@Injectable({ providedIn: 'root' })
export class MetasService {
  metas = signal<MetaVendedor[]>([]);
  anioCargado = signal<number | null>(null);
  cargando = signal(false);

  async cargarAnio(anio: number): Promise<void> {
    this.cargando.set(true);
    try {
      const { data, error } = await supabase
        .from(TABLA)
        .select('vendedor, anio, mes, meta_clp, categoria')
        .eq('anio', anio)
        .order('vendedor', { ascending: true });
      if (error) throw error;
      const lista: MetaVendedor[] = (data ?? []).map((r) => ({
        vendedor: r.vendedor,
        anio: r.anio,
        mes: r.mes,
        metaClp: Number(r.meta_clp) || 0,
        categoria: r.categoria ?? '',
      }));
      this.metas.set(lista);
      this.anioCargado.set(anio);
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
    if (filas.length === 0) {
      onProgress({ fase: 'completado', pct: 100, mensaje: 'Archivo sin metas válidas.' });
      return;
    }

    // Reemplazar todas las metas del año para mantener consistencia.
    const { error: errDel } = await supabase.from(TABLA).delete().eq('anio', anio);
    if (errDel) throw errDel;

    onProgress({
      fase: 'comprimiendo',
      pct: 0,
      totalFilas: filas.length,
      mensaje: `Subiendo ${filas.length} filas de metas...`,
    });

    const totalLotes = Math.ceil(filas.length / BATCH_SIZE);
    for (let i = 0; i < totalLotes; i++) {
      const lote = filas.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE).map((m) => ({
        vendedor: m.vendedor,
        anio: m.anio,
        mes: m.mes,
        meta_clp: Math.round(m.metaClp),
        categoria: m.categoria || null,
      }));
      const { error } = await supabase.from(TABLA).insert(lote);
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

    if (this.anioCargado() === anio || this.anioCargado() === null) {
      await this.cargarAnio(anio);
    }
    onProgress({ fase: 'completado', pct: 100, mensaje: '¡Metas cargadas!' });
  }

  async borrarAnio(anio: number): Promise<void> {
    const { error } = await supabase.from(TABLA).delete().eq('anio', anio);
    if (error) throw error;
    if (this.anioCargado() === anio) {
      this.metas.set([]);
      this.anioCargado.set(null);
    }
  }

  // Guarda la grilla editada desde la UI: reemplaza todas las metas del año.
  // Sólo persiste celdas con meta > 0 (el resto se considera "sin meta").
  async guardarAnio(anio: number, metas: MetaVendedor[]): Promise<void> {
    const { error: errDel } = await supabase.from(TABLA).delete().eq('anio', anio);
    if (errDel) throw errDel;

    const validas = metas.filter((m) => m.metaClp > 0);
    for (let i = 0; i < validas.length; i += BATCH_SIZE) {
      const lote = validas.slice(i, i + BATCH_SIZE).map((m) => ({
        vendedor: m.vendedor,
        anio,
        mes: m.mes,
        meta_clp: Math.round(m.metaClp),
        categoria: m.categoria || null,
      }));
      const { error } = await supabase.from(TABLA).insert(lote);
      if (error) throw error;
    }
    await this.cargarAnio(anio);
  }

  private parsearCsv(
    archivo: File,
    anio: number,
    onProgress: (p: ProgresoCarga) => void,
  ): Promise<MetaVendedor[]> {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(archivo, {
        header: true,
        skipEmptyLines: true,
        worker: false,
        complete: (results) => {
          const fields = results.meta.fields ?? [];
          const cols = this.detectarColumnas(fields);
          if (!cols.vendedor) {
            reject(new Error('El CSV debe tener una columna "vendedor".'));
            return;
          }
          if (cols.meses.filter(Boolean).length === 0) {
            reject(
              new Error(
                'El CSV debe tener columnas de meses (ENERO, FEBRERO, ... DICIEMBRE).',
              ),
            );
            return;
          }

          const out: MetaVendedor[] = [];
          for (const row of results.data) {
            const vendedor = row[cols.vendedor]?.toString().trim();
            if (!vendedor) continue;
            const categoria = cols.categoria
              ? row[cols.categoria]?.toString().trim().toUpperCase() ?? ''
              : '';
            for (let m = 0; m < 12; m++) {
              const colMes = cols.meses[m];
              if (!colMes) continue;
              const raw = row[colMes];
              const val = toNumber(raw ?? '');
              // Sólo guardar filas con valor > 0; el resto se considera "sin meta"
              if (val > 0) {
                out.push({ vendedor, anio, mes: m + 1, metaClp: val, categoria });
              }
            }
          }
          onProgress({
            fase: 'parseando',
            pct: 100,
            filasProcesadas: out.length,
            mensaje: `Detectadas ${out.length} metas mensuales.`,
          });
          resolve(out);
        },
        error: (err) => reject(err),
      });
    });
  }

  private detectarColumnas(fields: string[]): {
    vendedor?: string;
    categoria?: string;
    meses: (string | undefined)[];
  } {
    const result: { vendedor?: string; categoria?: string; meses: (string | undefined)[] } = {
      meses: Array(12).fill(undefined),
    };
    const norm = (s: string) => s.toLowerCase().trim();
    for (const f of fields) {
      const n = norm(f);
      if (!result.vendedor && /vendedor|nombre/.test(n)) result.vendedor = f;
      else if (!result.categoria && /categor/.test(n)) result.categoria = f;
      else {
        const idx = MESES_CSV.findIndex((m) => m.toLowerCase() === n);
        if (idx >= 0) result.meses[idx] = f;
      }
    }
    return result;
  }
}
