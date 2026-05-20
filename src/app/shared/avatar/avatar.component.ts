import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      [style.backgroundColor]="color"
      [style.width.px]="sizePx"
      [style.height.px]="sizePx"
      [style.fontSize.px]="fontPx"
      [attr.aria-label]="label || iniciales"
    >
      {{ iniciales }}
    </span>
  `,
})
export class AvatarComponent {
  @Input() iniciales = '';
  @Input() color = '#3b82f6';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() label?: string;

  get sizePx(): number {
    return { sm: 28, md: 36, lg: 44, xl: 56 }[this.size];
  }
  get fontPx(): number {
    return { sm: 11, md: 13, lg: 16, xl: 20 }[this.size];
  }
}
