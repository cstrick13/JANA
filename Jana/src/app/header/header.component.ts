import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { invoke } from '@tauri-apps/api/core';

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
            this.userRole = role || 'worker';
            console.log('Role from Tauri:', this.userRole);
          })
          .catch(err => {
            console.error('Error reading role from Tauri storage:', err);
            this.userRole = '';
          });
      } else {
        this.userName = '';
        this.userRole = '';
      }
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
    this.authService.logout().then(async () => {
      // Reset any local state after logout
      this.userRole = '';
      this.userName = '';
      this.isLoggedIn = false;
      this.currentUser = null;
      this.hasProfile = false;

      try {
        // Update Tauri storage: set 'isLoggedIn' to "false"
        await invoke('set_local_storage', { key: 'isLoggedIn', value: 'false' });
        // Clear displayName from Tauri storage by setting it to an empty string
        await invoke('set_local_storage', { key: 'displayName', value: '' });
      } catch (err) {
        console.error('Error updating Tauri storage during logout:', err);
      }

      // Navigate to the login page and reload the window
      this.router.navigate(['/login']);
      window.location.reload();
    }).catch(error => {
      console.error('Error during logout:', error);
    });
    invoke('set_local_storage', { key: 'chatMessages', value: '' })
    .then(() => {
      console.log('Cleared chat messages from Tauri storage');
    })
    .catch(err => {
      console.error('Error clearing chat messages from Tauri storage', err);
    });
  }
onSearch(): void {
  if (!this.searchQuery.trim()) { return; }
  // TODO: wire up actual search logic (router navigation, service call, etc.)
  console.log('Searching for:', this.searchQuery);
}
}
