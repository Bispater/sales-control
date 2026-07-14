import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { TopbarComponent } from './shared/topbar/topbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <ng-container *ngIf="!esLogin(); else loginLayout">
      <div class="min-h-screen flex bg-slate-50">
        <!-- Sidebar fijo (desktop) -->
        <div class="hidden lg:block sticky top-0 h-screen">
          <app-sidebar></app-sidebar>
        </div>

        <!-- Drawer (móvil) -->
        <ng-container *ngIf="menuAbierto()">
          <div class="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" (click)="menuAbierto.set(false)"></div>
          <div class="fixed inset-y-0 left-0 z-50 lg:hidden">
            <app-sidebar (navegar)="menuAbierto.set(false)"></app-sidebar>
          </div>
        </ng-container>

        <!-- Columna principal -->
        <div class="flex-1 min-w-0 flex flex-col">
          <app-topbar (alternarMenu)="menuAbierto.set(!menuAbierto())"></app-topbar>
          <main class="flex-1 px-4 sm:px-6 py-6">
            <div class="max-w-[1400px] mx-auto">
              <router-outlet></router-outlet>
            </div>
          </main>
        </div>
      </div>
    </ng-container>
    <ng-template #loginLayout>
      <router-outlet></router-outlet>
    </ng-template>
  `,
})
export class AppComponent {
  private router = inject(Router);

  menuAbierto = signal(false);

  esLogin = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/login')),
      startWith(this.router.url.startsWith('/login')),
    ),
    { initialValue: false },
  );
}
