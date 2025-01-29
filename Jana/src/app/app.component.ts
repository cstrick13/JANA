import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { invoke } from "@tauri-apps/api/core";
import { RouterModule } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { JanaComponent } from './jana/jana.component';
import { WizardConfigService } from './wizard-config.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet,RouterModule,HomeComponent,JanaComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {

  constructor(
    public router: Router,
    public wizardConfigService: WizardConfigService
  ) {}

  greetingMessage = "";

  greet(event: SubmitEvent, name: string): void {
    event.preventDefault();

    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    invoke<string>("greet", { name }).then((text) => {
      this.greetingMessage = text;
    });
  }
}
