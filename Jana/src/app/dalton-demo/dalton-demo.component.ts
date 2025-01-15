import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { RouterModule, RouterOutlet } from '@angular/router';
import { WizardConfigService } from '../wizard-config.service';

@Component({
  selector: 'app-dalton-demo',
  standalone: true, // Mark as standalone
  imports: [CommonModule, HttpClientModule,RouterOutlet, RouterModule], // Use imports here
  templateUrl: './dalton-demo.component.html',
  styleUrls: ['./dalton-demo.component.css']
})
export class DaltonDemoComponent {
  file: File | null = null;
  transcription: string = '';
  isLoading: boolean = false;

  constructor(private http: HttpClient,private wizardConfigService: WizardConfigService) {}

  wizardConfig: any;

  ngOnInit() {
    this.wizardConfig = this.wizardConfigService.getConfig();
  }


  handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input?.files && input.files.length > 0) {
      this.file = input.files[0];
    }
  }

  submitFile(): void {
    if (!this.file) {
      alert('Please select a file before submitting.');
      return;
    }

    this.isLoading = true;
    const formData = new FormData();
    formData.append('audio', this.file);

    this.http.post<{ transcription: string }>('http://127.0.0.1:5000/transcribe', formData)
      .subscribe(
        (response: { transcription: string }) => {
          this.transcription = response.transcription;
          this.isLoading = false;
        },
        (error: any) => {
          console.error('Error:', error);
          this.isLoading = false;
        }
      );
  }
}
