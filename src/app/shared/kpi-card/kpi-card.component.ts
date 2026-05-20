import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-xl shadow-card border border-slate-100 p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm text-slate-500 font-medium">{{ titulo }}</p>
          <p class="text-2xl font-bold text-slate-900 mt-1 truncate">{{ valor }}</p>
          <p *ngIf="subtitulo" class="text-xs text-slate-500 mt-1">{{ subtitulo }}</p>
          <p *ngIf="delta" class="text-xs mt-1" [class.text-emerald-600]="positivo" [class.text-rose-600]="!positivo">
            {{ delta }}
          </p>
        </div>
        <div *ngIf="icono" class="p-2 rounded-lg shrink-0"
             [style.backgroundColor]="iconoFondo"
             [style.color]="iconoColor">
          <span [innerHTML]="icono"></span>
        </div>
      </div>
    </div>
  `,
})
export class KpiCardComponent {
  @Input() titulo = '';
  @Input() valor: string | number = '';
  @Input() subtitulo?: string;
  @Input() delta?: string;
  @Input() positivo = true;
  @Input() icono?: string;
  @Input() iconoColor = '#2563eb';
  @Input() iconoFondo = '#eff6ff';
}
