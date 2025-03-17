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
  isLoggedIn = false;


  constructor(
    public router: Router,
    public wizardConfigService: WizardConfigService,
    private authService: AuthService 
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe((user) => {
      this.isLoggedIn = !!user;
      console.log('AuthService emitted loggedIn state:', this.isLoggedIn);
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
