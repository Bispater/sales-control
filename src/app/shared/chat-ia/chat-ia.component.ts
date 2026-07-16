import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatIaService } from '../../services/chat-ia.service';

// Burbuja flotante + panel de chat. Se monta una vez en app.component y queda
// disponible en todas las pantallas.
@Component({
  selector: 'app-chat-ia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Burbuja -->
    <button
      *ngIf="!chat.abierto()"
      (click)="chat.abierto.set(true)"
      title="Preguntar a la IA"
      class="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-slate-900 text-white shadow-lg
             hover:bg-slate-800 hover:scale-105 transition-all flex items-center justify-center">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
      </svg>
    </button>

    <!-- Panel -->
    <div
      *ngIf="chat.abierto()"
      class="fixed z-50 bg-white shadow-2xl flex flex-col
             inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[620px] sm:rounded-2xl sm:border sm:border-slate-200">
      <!-- Encabezado -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-200 shrink-0">
        <div class="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-900 leading-tight">Asistente</p>
          <p class="text-xs text-slate-500 leading-tight">Consulta tus datos en lenguaje natural</p>
        </div>
        <button *ngIf="chat.mensajes().length" (click)="chat.limpiar()" title="Nueva conversación"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992M4.031 9.348a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m-18.03 4.822 3.181 3.182a8.25 8.25 0 0 0 13.803-3.7" />
          </svg>
        </button>
        <button (click)="chat.abierto.set(false)" title="Cerrar"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mensajes -->
      <div #scroll class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <!-- Estado vacío con ejemplos -->
        <div *ngIf="!chat.mensajes().length" class="pt-6">
          <p class="text-sm text-slate-500 mb-3">Prueba con algo así:</p>
          <button *ngFor="let s of sugerencias" (click)="enviar(s)"
                  class="block w-full text-left text-sm px-3 py-2.5 mb-2 rounded-lg border border-slate-200
                         text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors">
            {{ s }}
          </button>
        </div>

        <div *ngFor="let m of chat.mensajes()">
          <!-- Usuario -->
          <div *ngIf="m.rol === 'user'" class="flex justify-end">
            <div class="max-w-[85%] bg-slate-900 text-white text-sm rounded-2xl rounded-br-sm px-3.5 py-2.5 whitespace-pre-wrap">
              {{ m.texto }}
            </div>
          </div>

          <!-- Asistente -->
          <div *ngIf="m.rol === 'assistant'" class="flex flex-col gap-1.5">
            <div class="max-w-[92%] text-sm rounded-2xl rounded-bl-sm px-3.5 py-2.5 whitespace-pre-wrap"
                 [ngClass]="m.error ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-800'">
              {{ m.texto }}
            </div>
            <!-- Transparencia: qué consultó para responder eso -->
            <details *ngIf="m.consultas?.length" class="max-w-[92%]">
              <summary class="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                {{ m.consultas!.length }} consulta{{ m.consultas!.length > 1 ? 's' : '' }} a la base
              </summary>
              <div *ngFor="let c of m.consultas" class="mt-1.5 border-l-2 border-slate-200 pl-2.5">
                <p class="text-xs text-slate-500">{{ c.motivo }}</p>
                <pre class="text-[11px] text-slate-400 mt-1 overflow-x-auto whitespace-pre-wrap font-mono">{{ c.sql }}</pre>
              </div>
            </details>
          </div>
        </div>

        <!-- Pensando -->
        <div *ngIf="chat.pensando()" class="flex gap-1.5 px-3.5 py-3">
          <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style="animation-delay:0ms"></span>
          <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style="animation-delay:150ms"></span>
          <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style="animation-delay:300ms"></span>
        </div>
      </div>

      <!-- Entrada -->
      <div class="border-t border-slate-200 p-3 shrink-0">
        <div class="flex items-end gap-2">
          <textarea
            [(ngModel)]="borrador"
            (keydown.enter)="onEnter($event)"
            rows="1"
            placeholder="Pregunta por cualquier dato…"
            class="flex-1 resize-none text-sm px-3 py-2.5 rounded-xl border border-slate-200 max-h-32
                   focus:outline-none focus:border-slate-400 placeholder:text-slate-400"></textarea>
          <button (click)="enviar(borrador)" [disabled]="!borrador.trim() || chat.pensando()"
                  class="w-10 h-10 shrink-0 rounded-xl bg-slate-900 text-white flex items-center justify-center
                         hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p class="text-[11px] text-slate-400 mt-2 text-center">Sólo lectura · puede equivocarse, verifica lo importante</p>
      </div>
    </div>
  `,
})
export class ChatIaComponent {
  chat = inject(ChatIaService);

  @ViewChild('scroll') scroll?: ElementRef<HTMLDivElement>;

  borrador = '';

  sugerencias = [
    '¿Cuánto vendimos este mes y cómo vamos contra la meta?',
    '¿Quiénes son los 5 clientes que más compraron este año?',
    '¿Qué clientes no compran hace más de 60 días?',
    '¿Qué productos dejan mejor margen?',
  ];

  private ultimoConteo = signal(0);

  constructor() {
    // Auto-scroll cuando entra un mensaje o aparece el indicador de "pensando".
    effect(() => {
      const n = this.chat.mensajes().length;
      const pensando = this.chat.pensando();
      if (n === this.ultimoConteo() && !pensando) return;
      this.ultimoConteo.set(n);
      queueMicrotask(() => {
        const el = this.scroll?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  onEnter(e: Event): void {
    const ev = e as KeyboardEvent;
    if (ev.shiftKey) return; // Shift+Enter = salto de línea
    ev.preventDefault();
    this.enviar(this.borrador);
  }

  enviar(texto: string): void {
    if (!texto.trim() || this.chat.pensando()) return;
    this.borrador = '';
    // TODO: pasar el vendedor activo cuando el dashboard tenga selector de identidad.
    this.chat.preguntar(texto, null);
  }
}
