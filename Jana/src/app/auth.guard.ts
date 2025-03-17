import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean> {
    // Wait for the currentUser$ observable to emit a value
    return this.authService.currentUser$.pipe(
      take(1), // Only take the first emitted value
      map(user => {
        if (user) {
          return true; // User is authenticated, allow route activation
        } else {
          this.router.navigate(['/login']); // Not logged in, redirect to login
          return false;
        }
      })
    );
  }
}
