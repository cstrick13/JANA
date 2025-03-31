import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, signInWithCustomToken, signOut, User } from 'firebase/auth';
import { invoke } from '@tauri-apps/api/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null> = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  private currentRoleSubject: BehaviorSubject<string> = new BehaviorSubject<string>('operator');
  public currentRole$: Observable<string> = this.currentRoleSubject.asObservable();

  constructor() {
    const auth = getAuth();
    // Set persistence explicitly
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            // Normal auth state update if we have a user.
            this.currentUserSubject.next(user);
            console.log('Firebase auth state changed:', user);
          } else {
            // Firebase session is lost. Check Tauri storage to see if user was logged in.
            try {
              const flag = await invoke<string>('get_local_storage', { key: 'isLoggedIn' });
              if (flag === 'true') {
                console.warn('Firebase session lost but Tauri indicates user was logged in. Attempting reauthentication...');
                await this.reauthenticateUser();
                // Do not overwrite the subject here—reauthenticateUser() will update it.
              } else {
                // No reauthentication triggered, so set to null.
                this.currentUserSubject.next(null);
                console.log('Firebase auth state changed: null');
              }
            } catch (err) {
              console.error('Error retrieving isLoggedIn from Tauri storage:', err);
              this.currentUserSubject.next(null);
            }
          }
        });
      })
      .catch((error) => {
        console.error('Error setting persistence:', error);
      });
    this.loadRole();
  }

  // Reauthenticate the user using a stored custom token
  private async reauthenticateUser(): Promise<void> {
    const auth = getAuth();
    try {
      const token = await invoke<string>('get_local_storage', { key: 'customToken' });
      console.log('Retrieved custom token for reauthentication:', token);
      if (token) {
        const userCredential = await signInWithCustomToken(auth, token);
        console.log('User reauthenticated successfully:', userCredential.user);
        this.currentUserSubject.next(userCredential.user);
      } else {
        console.warn('No custom token found for reauthentication.');
        await invoke('set_local_storage', { key: 'isLoggedIn', value: 'false' });
        this.currentUserSubject.next(null);
        this.logout();
      }
    } catch (error) {
      console.error('Reauthentication failed:', error);
      await invoke('set_local_storage', { key: 'isLoggedIn', value: 'false' });
      this.currentUserSubject.next(null);
      this.logout();
    }
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getUser(): User | null {
    return this.currentUserSubject.value;
  }

  async loadRole(): Promise<void> {
    try {
      const role = await invoke<string>('get_local_storage', { key: 'role' });
      this.currentRoleSubject.next(role || 'operator');
    } catch (error) {
      console.error('Error loading role from Tauri storage:', error);
      this.currentRoleSubject.next('operator');
    }
  }

  async updateRole(role: string): Promise<void> {
    try {
      await invoke('set_local_storage', { key: 'role', value: role });
      this.currentRoleSubject.next(role);
    } catch (error) {
      console.error('Error updating role in Tauri storage:', error);
    }
  }

  updateCurrentUser(user: User | null): void {
    this.currentUserSubject.next(user);
    console.log('Updated current user:', user);
  }

  logout(): Promise<void> {
    const auth = getAuth();
    // Reset role and update storage for logout
    this.updateRole('operator');
    invoke('set_local_storage', { key: 'isLoggedIn', value: 'false' })
      .then(result => console.log('isLoggedIn updated in Tauri storage on logout:', result))
      .catch(err => console.error('Error updating isLoggedIn in Tauri storage on logout:', err));
    return signOut(auth);
  }
}
