import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { getAuth, onAuthStateChanged, signOut, User } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // BehaviorSubject to hold the current user (null if not logged in)
  private currentUserSubject: BehaviorSubject<User | null> = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  // BehaviorSubject for the current role, initialized from localStorage (or 'operator' by default)
  private currentRoleSubject: BehaviorSubject<string> = new BehaviorSubject<string>(this.getRole());
  public currentRole$: Observable<string> = this.currentRoleSubject.asObservable();

  constructor() {
    const auth = getAuth();
    // Listen for authentication state changes
    onAuthStateChanged(auth, (user) => {
      this.currentUserSubject.next(user);
      console.log('Firebase auth state changed:', user);
      // Optionally, you could update the role here if it depends on user info
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

  // Returns the current role stored in localStorage (or defaults to 'operator')
  getRole(): string {
    return localStorage.getItem('role') || 'operator';
  }

  // Helper method to update the role both in localStorage and in the BehaviorSubject
  updateRole(role: string): void {
    localStorage.setItem('role', role);
    this.currentRoleSubject.next(role);
  }
  updateCurrentUser(user: User | null): void {
    this.currentUserSubject.next(user);
    console.log('Updated current user:', user);
  }

  // Log out the user and reset the role if needed
  logout(): Promise<void> {
    const auth = getAuth();
    // Optionally reset the role on logout
    this.updateRole('operator');
    localStorage.removeItem('isLoggedIn');
    return signOut(auth);
  }
}
