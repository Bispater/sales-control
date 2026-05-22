import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen w-full bg-slate-50 flex items-center justify-center px-4 py-10">
      <div class="w-full max-w-md">
        <div class="flex flex-col items-center mb-6">
          <span class="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-lg">CV</span>
          <h1 class="text-xl font-bold text-slate-900 mt-3">Control de Ventas</h1>
          <p class="text-sm text-slate-500 mt-1">Inicia sesión para continuar</p>
        </div>

        <div class="bg-white rounded-xl shadow-card border border-slate-100 p-6">
          <form (ngSubmit)="submit()" class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                required
                autocomplete="email"
                placeholder="tu@email.com"
                class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Contraseña</label>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                required
                minlength="6"
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            <div *ngIf="error()" class="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2">
              {{ error() }}
            </div>

            <button
              type="submit"
              [disabled]="cargando()"
              class="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition"
            >
              {{ cargando() ? 'Procesando...' : 'Iniciar sesión' }}
            </button>
          </form>

        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  password = '';
  error = signal<string>('');
  cargando = signal(false);

  async submit() {
    if (!this.email || !this.password) {
      this.error.set('Email y contraseña son requeridos.');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    try {
      await this.authService.loginEmail(this.email, this.password);
      this.redirigir();
    } catch (e) {
      this.error.set(this.traducirError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async entrarGoogle() {
    this.cargando.set(true);
    this.error.set('');
    try {
      await this.authService.loginGoogle();
      this.redirigir();
    } catch (e) {
      this.error.set(this.traducirError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private redirigir() {
    const url = this.route.snapshot.queryParamMap.get('redirect') || '/dashboard';
    this.router.navigateByUrl(url);
  }

  private traducirError(e: unknown): string {
    if (e instanceof FirebaseError) {
      switch (e.code) {
        case 'auth/invalid-email': return 'El email no es válido.';
        case 'auth/user-disabled': return 'Esta cuenta está deshabilitada.';
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
        case 'auth/wrong-password': return 'Email o contraseña incorrectos.';
        case 'auth/email-already-in-use': return 'Ya existe una cuenta con ese email.';
        case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.';
        case 'auth/popup-closed-by-user': return 'La ventana de Google se cerró antes de finalizar.';
        case 'auth/popup-blocked': return 'El navegador bloqueó la ventana emergente. Permítela e intenta de nuevo.';
        case 'auth/network-request-failed': return 'Sin conexión. Verifica tu red.';
        default: return e.message;
      }
    }
    return 'Ocurrió un error inesperado.';
  }
}
