import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { RouterModule } from '@angular/router';
import Chart from 'chart.js/auto';
import { AuthService } from '../auth.service';
import { invoke } from '@tauri-apps/api/core';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrl: './home.component.css',
    standalone: false
})
export class HomeComponent implements OnInit {
    @ViewChild('bandwidthCanvas') canvas!: ElementRef<HTMLCanvasElement>;
    userRole: string = ''; // Track user role
    userName: string = ''; // Track user name
    isLoggedIn: boolean = false; // Track login status
    currentUser: any; // Track current user
    hasProfile: boolean = false; // Track if the user has a profile
    authUnsubscribe: any; // Unsubscribe function
    searchQuery = '';
    isLoading: boolean = true;

    constructor(
        private cdr: ChangeDetectorRef,
        private router: Router, private authService: AuthService // Typed injection for AuthService
      ) {}


      ngOnInit() {
        // Start loading
        this.isLoading = true;
      
        // Subscribe to authentication changes
        this.authService.currentUser$.subscribe(user => {
          this.isLoggedIn = !!user;
          if (user) {
            // Retrieve both display name and role concurrently
            Promise.all([
              invoke<string>('get_local_storage', { key: 'displayName' }),
              invoke<string>('get_local_storage', { key: 'role' })
            ])
            .then(([name, role]) => {
              this.userName = name || 'User';
              this.userRole = role || 'operator';
              console.log('Display name from Tauri:', this.userName);
              console.log('Role from Tauri:', this.userRole);
            })
            .catch(err => {
              console.error('Error reading from Tauri storage:', err);
              // Set fallback values if retrieval fails
              this.userName = 'User';
              this.userRole = 'operator';
            })
            .finally(() => {
              // Stop loading once both values have been handled
              this.isLoading = false;
            });
          } else {
            this.userName = '';
            this.userRole = '';
            this.isLoading = false;
          }
          console.log('Authentication status updated:', this.isLoggedIn, 'Username:', this.userName);
        });
      }
      
      

    
}
