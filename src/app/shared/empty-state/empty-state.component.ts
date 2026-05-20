import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="bg-white rounded-xl shadow-card border border-slate-100 p-12 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-50 text-brand-600 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.75h16.5m-16.5 6.75h16.5"/>
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-slate-900">{{ titulo }}</h3>
      <p class="text-sm text-slate-500 mt-2 max-w-md mx-auto">{{ descripcion }}</p>
      <a *ngIf="enlace" [routerLink]="enlace" class="inline-flex items-center gap-1 mt-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
        {{ enlaceLabel }}
      </a>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() titulo = 'Sin datos';
  @Input() descripcion = '';
  @Input() enlace?: string;
  @Input() enlaceLabel = 'Ir';
}
