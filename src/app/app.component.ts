import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { HeaderComponent } from './shared/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent],
  template: `
    <ng-container *ngIf="!esLogin(); else loginLayout">
      <app-header></app-header>
      <main class="max-w-[1400px] mx-auto px-6 py-6">
        <router-outlet></router-outlet>
      </main>
    </ng-container>
    <ng-template #loginLayout>
      <router-outlet></router-outlet>
    </ng-template>
  `,
})
export class AppComponent {
  private router = inject(Router);

  esLogin = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/login')),
      startWith(this.router.url.startsWith('/login')),
    ),
    { initialValue: false },
  );
}
