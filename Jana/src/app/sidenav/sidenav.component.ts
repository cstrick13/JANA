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

    // Subscribe to role changes to update navData when the role changes
    this.authService.currentRole$.subscribe((role) => {
      this.loadNavDataBasedOnRole(role);
    });

    // Optionally, on every route change, force a reload of the role from storage.
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.authService.loadRole();
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
    const userNavData = [
      { routeLink: 'home', icon: 'fas fa-home', label: 'Dashboard' },
      { routeLink: 'analytics', icon: 'fa-solid fa-magnifying-glass-chart', label: 'Monitor' },
      { routeLink: 'jana', icon: 'fa-solid fa-robot', label: 'Jana' },
      { routeLink: 'settings', icon: 'fas fa-cog', label: 'Settings' }
    ];

    const adminNavData = [
      { routeLink: 'home', icon: 'fas fa-home', label: 'Dashboard' },
      { routeLink: 'analytics', icon: 'fa-solid fa-magnifying-glass-chart', label: 'Monitor' },
      { routeLink: 'jana', icon: 'fa-solid fa-robot', label: 'Jana' },
      { routeLink: '', icon: 'fas fa-users-cog', label: 'User Management' },
      { routeLink: '', icon: 'fas fa-clipboard-list', label: 'System Logs' },
      { routeLink: '', icon: 'fas fa-chart-line', label: 'Reports' },
      { routeLink: 'settings', icon: 'fas fa-cog', label: 'Settings' }
    ];
    
    const superAdminNavData = [
      { routeLink: 'home', icon: 'fas fa-home', label: 'Dashboard' },
      { routeLink: 'analytics', icon: 'fa-solid fa-magnifying-glass-chart', label: 'Monitor' },
      { routeLink: 'jana', icon: 'fa-solid fa-robot', label: 'Jana' },
      { routeLink: '', icon: 'fas fa-users-cog', label: 'User Management' },
      { routeLink: '', icon: 'fas fa-clipboard-list', label: 'System Logs' },
      { routeLink: '', icon: 'fas fa-chart-line', label: 'Reports' },
      { routeLink: '', icon: 'fas fa-user-shield', label: 'Permissions' },
      { routeLink: '', icon: 'fas fa-search-plus', label: 'Audit Trail' },
      { routeLink: 'settings', icon: 'fas fa-cog', label: 'Settings' }
    ];

    // Update navData based on role
    if(role == 'Admin'){
      this.navData = adminNavData;
    } else if(role == 'Super'){
      this.navData = superAdminNavData;
    }else{
      this.navData = userNavData;
    }
  }
}
