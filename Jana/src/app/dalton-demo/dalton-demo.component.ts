import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-dalton-demo',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  templateUrl: './dalton-demo.component.html',
  styleUrls: ['./dalton-demo.component.css']
})
export class DaltonDemoComponent implements OnInit {

  isRecording = false;
  mediaRecorder: MediaRecorder | null = null;
  recordedChunks: Blob[] = [];
  audioURL: string | null = null;

  // Make sure you declare this property:
  translatedText: string = '';

  get hasMediaDevices(): boolean {
    return !!(window.navigator?.mediaDevices);
  }

  ngOnInit(): void {
    // ...
  }

  async toggleRecording() {
    if (!this.isRecording) {
      this.isRecording = true;
      await this.startRecording();
    } else {
      this.isRecording = false;
      this.stopRecording();
    }
  }

  private async startRecording() {
    try {
      const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.recordedChunks = [];

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      });

      this.mediaRecorder.addEventListener('stop', () => {
        const recordedBlob = new Blob(this.recordedChunks, { type: 'audio/ogg; codecs=opus' });
        this.audioURL = URL.createObjectURL(recordedBlob);

        // Example placeholder for logic that sets the transcribed/translated text.
        // Replace with your real logic or server calls:
        this.translatedText = 'Hello! This is your translated (or transcribed) text.';
      });

      this.mediaRecorder.start();
    } catch (error) {
      console.error('Could not start recording:', error);
      this.isRecording = true;
    }
  }

  private stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
  }
}
