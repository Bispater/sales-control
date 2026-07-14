import { Injectable, signal } from '@angular/core';
import { supabase } from '../supabase.config';

// Grupos de cliente para metas (coinciden con clientes_categoria.categoria).
export const GRUPOS = ['HOLDING', 'TERCEROS', 'TRABAJADORES'] as const;
export type Grupo = (typeof GRUPOS)[number];

export interface MetaGrupo {
  grupo: string;
  anio: number;
  mes: number;
  metaClp: number;
}

const TABLA_METAS = 'metas_grupo';
const TABLA_DIAS = 'dias_laborales';

@Injectable({ providedIn: 'root' })
export class GruposDiasService {
  // metas[grupo][mesIdx 0-11] = meta CLP
  metasGrupo = signal<Record<string, number[]>>({});
  // dias[mesIdx 0-11] = días laborales
  diasLaborales = signal<number[]>(Array(12).fill(0));
  anioCargado = signal<number | null>(null);
  cargando = signal(false);

  async cargarAnio(anio: number): Promise<void> {
    this.cargando.set(true);
    try {
      const [mg, dl] = await Promise.all([
        supabase.from(TABLA_METAS).select('grupo, mes, meta_clp').eq('anio', anio),
        supabase.from(TABLA_DIAS).select('mes, dias').eq('anio', anio),
      ]);
      if (mg.error) throw mg.error;
      if (dl.error) throw dl.error;

      const metas: Record<string, number[]> = {};
      for (const g of GRUPOS) metas[g] = Array(12).fill(0);
      for (const r of (mg.data ?? []) as { grupo: string; mes: number; meta_clp: number }[]) {
        const g = (r.grupo || '').toUpperCase();
        if (!metas[g]) metas[g] = Array(12).fill(0);
        if (r.mes >= 1 && r.mes <= 12) metas[g][r.mes - 1] = Number(r.meta_clp) || 0;
      }
      this.metasGrupo.set(metas);

      const dias = Array(12).fill(0);
      for (const r of (dl.data ?? []) as { mes: number; dias: number }[]) {
        if (r.mes >= 1 && r.mes <= 12) dias[r.mes - 1] = Number(r.dias) || 0;
      }
      this.diasLaborales.set(dias);
      this.anioCargado.set(anio);
    } finally {
      this.cargando.set(false);
    }
  }

  // Días laborales del mes (1-12) para el año cargado; 0 si no hay dato.
  diasDelMes(mes: number): number {
    return this.diasLaborales()[mes - 1] ?? 0;
  }

  async guardarMetasGrupo(anio: number, metas: Record<string, number[]>): Promise<void> {
    await supabase.from(TABLA_METAS).delete().eq('anio', anio);
    const filas: { grupo: string; anio: number; mes: number; meta_clp: number }[] = [];
    for (const g of Object.keys(metas)) {
      for (let i = 0; i < 12; i++) {
        const val = metas[g][i] ?? 0;
        if (val > 0) filas.push({ grupo: g, anio, mes: i + 1, meta_clp: Math.round(val) });
      }
    }
    if (filas.length > 0) {
      const { error } = await supabase.from(TABLA_METAS).insert(filas);
      if (error) throw error;
    }
    await this.cargarAnio(anio);
  }

  async guardarDiasLaborales(anio: number, dias: number[]): Promise<void> {
    await supabase.from(TABLA_DIAS).delete().eq('anio', anio);
    const filas = dias
      .map((d, i) => ({ anio, mes: i + 1, dias: Math.max(0, Math.round(d) || 0) }))
      .filter((f) => f.dias > 0);
    if (filas.length > 0) {
      const { error } = await supabase.from(TABLA_DIAS).insert(filas);
      if (error) throw error;
    }
    await this.cargarAnio(anio);
  }
}
