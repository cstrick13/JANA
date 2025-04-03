import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { invoke } from '@tauri-apps/api/core';
import { WizardConfigService } from './wizard-config.service';
import { AuthService } from './auth.service';

interface SideNavToggle {
  screenWidth: number;
  collapsed: boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: false
})
export class AppComponent implements OnInit {
  title = 'Interface';
  role = '';
  isLoggedIn = false;
  isLoading = true;
  authChecked = false;
  isSideNavCollapsed = false;
  screenWidth = 0;
  greetingMessage = '';

  constructor(
    public router: Router,
    public wizardConfigService: WizardConfigService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    console.log('➡️ Reading persisted login flag…');
    // Immediately update isLoggedIn from Tauri storage:
    invoke<string>('get_local_storage', { key: 'isLoggedIn' })
      .then(val => {
        console.log('⬅️ get_local_storage returned:', val);
        this.isLoggedIn = (val === 'true');
        console.log('🔑 isLoggedIn set to:', this.isLoggedIn);
      })
      .catch(err => console.error('❌ Error reading isLoggedIn:', err));
  
    const startTime = Date.now();
    const minimumLoadingTime = 2000;
  
    this.authService.currentUser$.subscribe(user => {
      console.log('Firebase auth state:', user);
      this.authChecked = true; // We've received an auth update
  
      if (user) {
        this.isLoggedIn = true;
        console.log('✅ User logged in — isLoggedIn =', this.isLoggedIn);
      }
  
      const elapsed = Date.now() - startTime;
      setTimeout(() => {
        this.isLoading = false;
        // Only decide to show login if no user is authenticated after the minimum loading time.
        if (!this.isLoggedIn && this.authChecked) {
          console.log('➡️ No authenticated user after auth check.');
          // Optionally, you can clear the login flag in Tauri storage here:
          invoke('set_local_storage', { key: 'isLoggedIn', value: 'false' })
            .then(res => console.log('⬅️ set_local_storage returned:', res))
            .catch(err => console.error('❌ Error clearing login flag:', err));
          // Navigate to login
          this.router.navigate(['/login']);
        }
      }, Math.max(0, minimumLoadingTime - elapsed));
    });
  }



  onToggleSideNav(data: SideNavToggle): void {
    this.screenWidth = data.screenWidth;
    this.isSideNavCollapsed = data.collapsed;
  }

  greet(event: SubmitEvent, name: string): void {
    event.preventDefault();
    invoke<string>('greet', { name })
      .then(text => this.greetingMessage = text)
      .catch(err => console.error('Greet invoke error:', err));
  }
}
