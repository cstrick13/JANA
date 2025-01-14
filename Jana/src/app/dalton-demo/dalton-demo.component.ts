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

  // Placeholder for the transcription from the server
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

        // Example placeholder text before sending to Whisper
        this.translatedText = 'Recorded locally. Ready to send to the server...';
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

  /**
   * Sends the recorded audio Blob to the local Flask server for transcription via Whisper.
   */
  async sendAudioToServer() {
    if (!this.audioURL) {
      console.warn('No audioURL to send.');
      return;
    }

    try {
      // 1. Convert the Blob URL back into a Blob
      const response = await fetch(this.audioURL);
      const audioBlob = await response.blob();

      // 2. Create FormData and append the Blob as a file
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.ogg');

      // 3. POST to your local server (Flask) endpoint
      const res = await fetch('http://localhost:5000/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.statusText}`);
      }

      // 4. Parse the server response
      const data = await res.json();
      // data might look like { transcript: "...some text..." }

      // 5. Update the translatedText in your UI
      this.translatedText = data.transcript || '(No transcript returned)';
    } catch (err) {
      console.error('Error sending audio to server:', err);
      this.translatedText = 'Error transcribing on server.';
    }
  }
}
