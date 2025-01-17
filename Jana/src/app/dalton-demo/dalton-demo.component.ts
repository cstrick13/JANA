import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';  // ✅ Import FormsModule for ngModel
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { RouterModule, RouterOutlet } from '@angular/router';
import { WizardConfigService } from '../wizard-config.service';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'app-dalton-demo',
	standalone: true, // ✅ Standalone component
	imports: [CommonModule, FormsModule, HttpClientModule, RouterOutlet, RouterModule], // ✅ Add FormsModule
	templateUrl: './dalton-demo.component.html',
	styleUrls: ['./dalton-demo.component.css']
})
export class DaltonDemoComponent {
	file: File | null = null;
	transcription: string = '';
	isLoading: boolean = false;
	recording: boolean = false;
	statusMessage: string = '';
	wizardConfig: any = null;

	private mediaRecorder: MediaRecorder | null = null;
	private chunks: BlobPart[] = [];

	constructor(private http: HttpClient, private wizardConfigService: WizardConfigService) { }

	ngOnInit() {
		this.wizardConfig = this.wizardConfigService.getConfig();
	}

	async requestMicrophonePermissions(): Promise<boolean> {
		try {
			await navigator.mediaDevices.getUserMedia({ audio: true });
			console.log("Microphone access granted.");
			return true;
		} catch (error) {
			console.error("Microphone access error:", error);
			this.statusMessage = "Microphone access denied.";
			return false;
		}
	}

	async toggleVoiceRecord() {
		if (!this.recording) {
			// Ask for microphone permissions first
			const permissionGranted = await this.requestMicrophonePermissions();
			if (!permissionGranted) {
				this.statusMessage = "Unable to start recording. Microphone access required.";
				return;
			}

			this.statusMessage = "Recording...";
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				this.mediaRecorder = new MediaRecorder(stream);
				this.chunks = [];

				this.mediaRecorder.ondataavailable = (event) => {
					this.chunks.push(event.data);
				};

				this.mediaRecorder.onstop = async () => {
					this.statusMessage = "Uploading audio...";
					const audioBlob = new Blob(this.chunks, { type: "audio/wav" });

					if (audioBlob) {
						const formData = new FormData();
						formData.append("audio", audioBlob, "recording.wav");

						try {
							const response = await firstValueFrom(this.http.post<{ transcription: string }>(
								"http://127.0.0.1:5000/transcribe", formData
							));
							console.log(response);
							this.transcription = response?.transcription || "No transcription received.";
							this.statusMessage = "Recording complete.";
						} catch (error) {
							console.error("Upload error:", error);
							this.statusMessage = "Upload failed.";
						}
					}
				};

				this.mediaRecorder.start();
				this.recording = true;
			} catch (error) {
				console.error("Microphone access error during recording setup:", error);
				this.statusMessage = "Failed to start recording.";
			}
		} else {
			if (this.mediaRecorder) {
				this.mediaRecorder.stop();
			}
			this.recording = false;
		}
	}
}
