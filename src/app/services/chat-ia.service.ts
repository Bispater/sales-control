import { Injectable, signal } from '@angular/core';
import { supabase } from '../supabase.config';

export interface ConsultaEjecutada {
  motivo: string;
  sql: string;
}

export interface MensajeChat {
  rol: 'user' | 'assistant';
  texto: string;
  consultas?: ConsultaEjecutada[];
  error?: boolean;
}

// Conversa con el Edge Function `chat-ia`, que es quien tiene la API key y el
// acceso de lectura a la base. El navegador nunca ve ninguna de las dos cosas.
@Injectable({ providedIn: 'root' })
export class ChatIaService {
  mensajes = signal<MensajeChat[]>([]);
  pensando = signal(false);
  abierto = signal(false);

  alternar(): void {
    this.abierto.set(!this.abierto());
  }

  limpiar(): void {
    this.mensajes.set([]);
  }

  async preguntar(texto: string, vendedor?: string | null): Promise<void> {
    const pregunta = texto.trim();
    if (!pregunta || this.pensando()) return;

    this.mensajes.set([...this.mensajes(), { rol: 'user', texto: pregunta }]);
    this.pensando.set(true);

    try {
      // Se manda el historial completo: la API no guarda estado.
      const historial = this.mensajes().map((m) => ({ role: m.rol, content: m.texto }));

      const { data, error } = await supabase.functions.invoke('chat-ia', {
        body: { mensajes: historial, hoy: this.hoyISO(), vendedor: vendedor ?? null },
      });
      if (error) throw error;

      if (data?.error) {
        this.agregarError(data.error);
        return;
      }

      this.mensajes.set([
        ...this.mensajes(),
        { rol: 'assistant', texto: data.respuesta ?? '', consultas: data.consultas ?? [] },
      ]);
    } catch (e) {
      console.warn('chat-ia:', e);
      this.agregarError('No pude conectar con el asistente. Revisa tu conexión e intenta de nuevo.');
    } finally {
      this.pensando.set(false);
    }
  }

  private agregarError(texto: string): void {
    this.mensajes.set([...this.mensajes(), { rol: 'assistant', texto, error: true }]);
  }

  // Fecha del navegador: el servidor corre en UTC y en Chile eso se corre un día.
  private hoyISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
