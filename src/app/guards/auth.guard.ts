import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase.config';

export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return new Promise<boolean>((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) {
        resolve(true);
      } else {
        router.navigate(['/login'], { queryParams: { redirect: state.url } });
        resolve(false);
      }
    });
  });
};

export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return new Promise<boolean>((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) {
        router.navigate(['/dashboard']);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};
