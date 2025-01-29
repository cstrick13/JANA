import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { WizardConfigService } from '../wizard-config.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-wizard-3',
  standalone: true,
  imports: [CommonModule, RouterOutlet,RouterModule,FormsModule ],
  templateUrl: './wizard-3.component.html',
  styleUrl: './wizard-3.component.css'
})
export class Wizard3Component {
  userName: string = '';
  commandWord: string = '';

  constructor(
    private wizardStateService: WizardConfigService,
    private router: Router
  ) {}

  onFinish(): void {
    // Save to service
    this.wizardStateService.userName = this.userName;
    this.wizardStateService.commandWord = this.commandWord;

    this.wizardStateService.wizardFinished = true; // ✅


  }
}
