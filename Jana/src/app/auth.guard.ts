import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { invoke } from '@tauri-apps/api/core';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): Promise<boolean> {
    return invoke<string>('get_local_storage', { key: 'isLoggedIn' })
      .then(val => {
        const loggedIn = (val === 'true');
        if (loggedIn) {
          return true;
        } else {
          this.router.navigate(['/login']);
          return false;
        }
      })
      .catch(err => {
        console.error('Error reading isLoggedIn:', err);
        this.router.navigate(['/login']);
        return false;
      });
  }
}
