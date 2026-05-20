import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full bg-slate-100 rounded-full overflow-hidden" [style.height.px]="alto">
      <div
        class="h-full rounded-full transition-all duration-500"
        [style.width.%]="clamp(valor)"
        [style.backgroundColor]="colorBarra"
      ></div>
    </div>
  `,
})
export class ProgressBarComponent {
  @Input() valor = 0;
  @Input() alto = 8;
  @Input() color?: string;

  get colorBarra(): string {
    if (this.color) return this.color;
    if (this.valor >= 100) return '#10b981';
    if (this.valor >= 75) return '#2563eb';
    if (this.valor >= 50) return '#f59e0b';
    return '#ef4444';
  }

  clamp(v: number): number {
    return Math.min(100, Math.max(0, v));
  }
}
