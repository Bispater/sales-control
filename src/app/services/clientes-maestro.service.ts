import { Injectable, signal } from '@angular/core';
import { supabase } from '../supabase.config';

/// Ficha maestra del cliente creada desde la app móvil (tabla `clientes`).
/// El directorio del dashboard la cruza por RUT para mostrar persona de
/// contacto, teléfono y crédito, que no vienen en los datos de ventas.
export interface ClienteMaestro {
  id: string;
  rut: string;
  nombre: string;
  tipo: number;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  credito: number;
  notas: string;
  vendedor: string;
}

const TABLA = 'clientes';

@Injectable({ providedIn: 'root' })
export class ClientesMaestroService {
  // Indexado por RUT normalizado para el cruce con el directorio.
  mapaPorRut = signal<Map<string, ClienteMaestro>>(new Map());
  totalCargados = signal<number>(0);
  cargando = signal(false);

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const map = new Map<string, ClienteMaestro>();
      let desde = 0;
      const page = 1000;
      while (true) {
        const { data, error } = await supabase
          .from(TABLA)
          .select('id, rut, nombre, tipo, contacto, email, telefono, direccion, lat, lng, credito, notas, vendedor')
          .order('created_at', { ascending: false })
          .range(desde, desde + page - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const row of data as Record<string, unknown>[]) {
          const c: ClienteMaestro = {
            id: String(row['id'] ?? ''),
            rut: String(row['rut'] ?? ''),
            nombre: String(row['nombre'] ?? ''),
            tipo: Number(row['tipo'] ?? 0),
            contacto: String(row['contacto'] ?? ''),
            email: String(row['email'] ?? ''),
            telefono: String(row['telefono'] ?? ''),
            direccion: String(row['direccion'] ?? ''),
            lat: row['lat'] != null ? Number(row['lat']) : null,
            lng: row['lng'] != null ? Number(row['lng']) : null,
            credito: Number(row['credito'] ?? 0),
            notas: String(row['notas'] ?? ''),
            vendedor: String(row['vendedor'] ?? ''),
          };
          const clave = this.normalizarRut(c.rut);
          // Sólo indexamos por RUT si existe; el más reciente gana (orden desc).
          if (clave && !map.has(clave)) map.set(clave, c);
        }
        if (data.length < page) break;
        desde += page;
      }
      this.mapaPorRut.set(map);
      this.totalCargados.set(map.size);
    } finally {
      this.cargando.set(false);
    }
  }

  porRut(rut: string | null | undefined): ClienteMaestro | null {
    if (!rut) return null;
    return this.mapaPorRut().get(this.normalizarRut(rut)) ?? null;
  }

  private normalizarRut(rut: string): string {
    return rut.trim().toUpperCase().replace(/\./g, '');
  }
}
