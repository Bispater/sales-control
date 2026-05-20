import { Injectable, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase.config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<User | null>(null);
  ready = signal<boolean>(false);

  constructor() {
    onAuthStateChanged(auth, (u) => {
      this.user.set(u);
      this.ready.set(true);
    });
  }

  loginEmail(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  registerEmail(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  loginGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  logout() {
    return signOut(auth);
  }

  isAuthenticated(): boolean {
    return !!this.user();
  }
}
