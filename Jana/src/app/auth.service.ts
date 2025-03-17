import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // BehaviorSubject to hold the current user (null if not logged in)
  private currentUserSubject: BehaviorSubject<User | null> = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor() {
    const auth = getAuth();
    // Listen for changes to the authentication state.
    onAuthStateChanged(auth, (user) => {
      this.currentUserSubject.next(user);
      console.log('Firebase auth state changed:', user);
    });
  }

  // Returns true if a user is logged in
  isAuthenticated(): boolean {
    return this.currentUserSubject.value != null;
  }

  // Returns the current user (or null)
  getUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Example: Determine the user's role based on email
  getRole(): string {
    return localStorage.getItem('role') || 'operator';
  }
}


