import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule, RouterOutlet } from '@angular/router';
import { WizardConfigService } from '../wizard-config.service';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-dalton-demo',
    templateUrl: './dalton-demo.component.html',
    styleUrls: ['./dalton-demo.component.css'],
	standalone: false
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

	async toggleVoiceRecord() {
		if (!this.recording) {
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
							const response = await firstValueFrom(
								this.http.post<{ transcription: string }>(
									"http://127.0.0.1:5000/transcribe", 
									formData
								)
							);
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
				console.error("Microphone access error:", error);
				this.statusMessage = "Microphone access denied.";
			}
		} else {
			if (this.mediaRecorder) {
				this.mediaRecorder.stop();
			}
			this.recording = false;
		}
	}

	async speak() {
		// Here we send the transcription text to TTS.
		if (!this.transcription.trim()) {
			this.statusMessage = "Nothing to speak. Please transcribe or provide text.";
			return;
		}

		try {
			this.statusMessage = "Generating speech...";
			// Use the Flask TTS endpoint
			const audioBlob = await firstValueFrom(
				this.http.post("http://127.0.0.1:5000/tts", 
					{ text: this.transcription }, 
					{ responseType: 'blob' }
				)
			);

			this.statusMessage = "Playing speech...";
			const audioURL = URL.createObjectURL(audioBlob);
			const audio = new Audio(audioURL);
			audio.play();

			// Optionally reset status after playback starts
			audio.onplaying = () => {
				this.statusMessage = "Speech playing...";
			};
			audio.onended = () => {
				this.statusMessage = "Speech finished.";
			};
		} catch (error) {
			console.error("TTS error:", error);
			this.statusMessage = "TTS request failed.";
		}
	}
}