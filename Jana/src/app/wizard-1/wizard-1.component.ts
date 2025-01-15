import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { WizardConfigService } from '../wizard-config.service';

@Component({
  selector: 'app-wizard-1',
  standalone: true,
  imports: [CommonModule, RouterOutlet,RouterModule,FormsModule ],
  templateUrl: './wizard-1.component.html',
  styleUrl: './wizard-1.component.css'
})
export class Wizard1Component {
  outputPath = '';
  terminalPath = '';

  constructor(
    private router: Router,
    private wizardConfigService: WizardConfigService
  ) {}

  onNext() {
    this.wizardConfigService.setConfig(this.outputPath, this.terminalPath);
    
    // Log the values to confirm they are set
    console.log('Wizard1Component - outputPath:', this.outputPath);
    console.log('Wizard1Component - terminalPath:', this.terminalPath);
    
    this.router.navigate(['/step2']);
  }
  
}
