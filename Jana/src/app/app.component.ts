import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { invoke } from "@tauri-apps/api/core";
import { RouterModule } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { JanaComponent } from './jana/jana.component';
import { WizardConfigService } from './wizard-config.service';
import { AuthService } from './auth.service';


interface SideNavToggle{
  screenWidth: number;
  collapsed:boolean;
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    standalone: false
})
export class AppComponent implements OnInit  {
  title = 'Interface';
  role: string = '';
  isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  isLoading = true;


  constructor(
    public router: Router,
    public wizardConfigService: WizardConfigService,
    private authService: AuthService 
  ) {}

  ngOnInit(): void {
    const startTime = Date.now();
    const minimumLoadingTime = 1000; // minimum time in milliseconds (1 second)
    this.authService.currentUser$.subscribe(user => {
      // Update local flag based on actual Firebase state
      this.isLoggedIn = !!user;
      if (!this.isLoggedIn) {
        localStorage.removeItem('isLoggedIn');
      }
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minimumLoadingTime - elapsed);

      // Delay hiding the loading screen by the remaining time
      setTimeout(() => {
        this.isLoading = false;
      }, remaining);
    });
  }

  isSideNavCollapsed = false;
  screenWidth = 0;
  onToggleSideNav(data:SideNavToggle): void{
    this.screenWidth = data.screenWidth;
    this.isSideNavCollapsed = data.collapsed;
  }

  greetingMessage = "";

  greet(event: SubmitEvent, name: string): void {
    event.preventDefault();

    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    invoke<string>("greet", { name }).then((text) => {
      this.greetingMessage = text;
    });
  }
}
