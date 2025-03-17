import { Component, EventEmitter, Output } from '@angular/core';
import { AuthService } from '../auth.service';
import { filter } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { navbarData } from './nav-data';

interface SideNavToggle {
  screenWidth: number;
  collapsed: boolean;
}

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.css'], // Corrected property name
  standalone: false
})
export class SidenavComponent {
  @Output() onToggleSideNav: EventEmitter<SideNavToggle> = new EventEmitter();
  collapsed = false;
  screenWidth = 0;
  navData = navbarData;

  myImage: string = 'assets/ai-brain.png';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.screenWidth = window.innerWidth;
    }

    // Subscribe to role changes using the updated observable
    this.authService.currentRole$.subscribe((role) => {
      this.loadNavDataBasedOnRole(role); // Update navData when role changes
    });

    // Initial load of role-based navigation data
    const initialRole = this.authService.getRole();
    this.loadNavDataBasedOnRole(initialRole);

    // Listen to route changes and refresh navigation data on route change
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        const currentRole = this.authService.getRole();
        this.loadNavDataBasedOnRole(currentRole);
      });
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.onToggleSideNav.emit({ collapsed: this.collapsed, screenWidth: this.screenWidth });
  }

  closeSidenav(): void {
    this.collapsed = false;
    this.onToggleSideNav.emit({ collapsed: this.collapsed, screenWidth: this.screenWidth });
  }

  loadNavDataBasedOnRole(role: string): void {
    const adminNavData = [
      { routeLink: 'admin-dashboard', icon: 'fas fa-home', label: 'Dashboard' },
      { routeLink: 'create', icon: 'fas fa-wrench', label: 'Build' },
      { routeLink: 'settings', icon: 'fas fa-cog', label: 'Settings' }
    ];

    const operatorNavData = [
      { routeLink: 'dashboard', icon: 'fas fa-home', label: 'Dashboard' },
      { routeLink: 'create', icon: 'fas fa-wrench', label: 'Build' },
      { routeLink: 'export', icon: 'fas fa-file', label: 'Export' },
      { routeLink: 'settings', icon: 'fas fa-cog', label: 'Settings' }
    ];

    // Update navData based on role
    this.navData = role === 'Admin' ? adminNavData : operatorNavData;
  }
}
