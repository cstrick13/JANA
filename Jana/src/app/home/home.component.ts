import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { RouterModule } from '@angular/router';
import Chart from 'chart.js/auto';
import { AuthService } from '../auth.service';

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
            // Assuming the user displayName is set (or you can pull data from a user service)
            this.userName = localStorage.getItem('displayName') || 'User';
            // Optionally, get the role from localStorage or another property
            this.userRole = localStorage.getItem('role') || 'operator';
          } else {
            this.userName = '';
            this.userRole = '';
          }
          console.log('Authentication status updated:', this.isLoggedIn);
          console.log('Authentication status updated:', this.isLoggedIn, 'Username:', this.userName);
        });
      }

      ngAfterViewInit() {
        new Chart(this.canvas.nativeElement, {
          type: 'line',
          data: {
            labels: ['00:00','04:00','08:00','12:00','16:00','20:00','24:00'],
            datasets: [{
              label: 'Mbps',
              data: [120,200,150,300,250,350,400],
              fill: true,
              tension: 0.4,
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            scales: {
              x: { display: true },
              y: { display: true, beginAtZero: true }
            },
            plugins: { legend: { display: false } }
          }
        });
      }
}
