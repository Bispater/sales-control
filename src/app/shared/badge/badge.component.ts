import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

type Tono = 'verde' | 'amarillo' | 'rojo' | 'azul' | 'gris' | 'violeta';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      [class]="clases"
    >
      <ng-content></ng-content>
    </span>
  `,
})
export class BadgeComponent {
  @Input() tono: Tono = 'gris';

  get clases(): string {
    const mapa: Record<Tono, string> = {
      verde: 'bg-emerald-100 text-emerald-700',
      amarillo: 'bg-amber-100 text-amber-700',
      rojo: 'bg-rose-100 text-rose-700',
      azul: 'bg-sky-100 text-sky-700',
      gris: 'bg-slate-100 text-slate-700',
      violeta: 'bg-violet-100 text-violet-700',
    };
    return mapa[this.tono];
  }
}
