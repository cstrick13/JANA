import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  standalone: false
})
export class HeaderComponent {
  UnreadNotifications: any = [];
  ReadNotifications: any = [];
  Requests:any=[];
  requests: any[] = [];
  UnreadAdminNotifications: any = [];
  ReadAdminNotifications: any = [];
  readadminnotifications: any[] = [];
  unreadadminnotifications: any[] = [];
  userRole: string = ''; // Track user role
  userName: string = ''; // Track user name
  isLoggedIn: boolean = false; // Track login status
  currentUser: any; // Track current user
  hasProfile: boolean = false; // Track if the user has a profile
  authUnsubscribe: any; // Unsubscribe function
  searchQuery = '';
  @Input() isSidebarCollapsed: boolean = false;

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

  getHeaderClass() {
    return this.isSidebarCollapsed ? 'header-collapsed' : 'header-expanded';
  }

  isAdmin(): boolean {
    return this.userRole === 'Admin';
  }
  
  

  onLogout() {
    this.authService.logout().then(() => {
      // Reset any local state after logout
      this.userRole = ''; 
      this.userName = ''; 
      this.isLoggedIn = false;
      this.currentUser = null;
      this.hasProfile = false;
      localStorage.removeItem('displayName');
      // Navigate to the login page
      this.router.navigate(['/login']);
      window.location.reload();
    }).catch(error => {
      console.error('Error during logout:', error);
    });
}
onSearch(): void {
  if (!this.searchQuery.trim()) { return; }
  // TODO: wire up actual search logic (router navigation, service call, etc.)
  console.log('Searching for:', this.searchQuery);
}
}
