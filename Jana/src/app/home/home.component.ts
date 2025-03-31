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

    constructor(
        private cdr: ChangeDetectorRef,
        private router: Router, private authService: AuthService // Typed injection for AuthService
      ) {}


      ngOnInit() {
        // Subscribe to authentication changes
        this.authService.currentUser$.subscribe(user => {
          this.isLoggedIn = !!user;
          if (user) {
            // Get the display name from Tauri storage
            invoke<string>('get_local_storage', { key: 'displayName' })
              .then(name => {
                this.userName = name || 'User';
                console.log('Display name from Tauri:', this.userName);
              })
              .catch(err => {
                console.error('Error reading displayName from Tauri storage:', err);
                this.userName = 'User';
              });
      
            // Get the role from Tauri storage
            invoke<string>('get_local_storage', { key: 'role' })
              .then(role => {
                this.userRole = role || 'operator';
                console.log('Role from Tauri:', this.userRole);
              })
              .catch(err => {
                console.error('Error reading role from Tauri storage:', err);
                this.userRole = 'operator';
              });
          } else {
            this.userName = '';
            this.userRole = '';
          }
          console.log('Authentication status updated:', this.isLoggedIn, 'Username:', this.userName);
        });
      }
      

    
}
