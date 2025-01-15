import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';


@Component({
  selector: 'app-wizard-2',
  standalone: true,
  imports: [CommonModule, RouterOutlet,RouterModule],
  templateUrl: './wizard-2.component.html',
  styleUrl: './wizard-2.component.css'
})
export class Wizard2Component implements OnInit {
  private audioContext!: AudioContext;
  private analyser!: AnalyserNode;
  private dataArray!: Uint8Array;
  private audio!: HTMLAudioElement;

  ngOnInit() {
    this.setupAudioVisualizer();
  }

  setupAudioVisualizer() {
    const canvas = document.getElementById('pulse-dot') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('Canvas context not found');
      return;
    }

    canvas.width = 200;
    canvas.height = 200;

    // Initialize AudioContext and AnalyserNode
    this.audioContext = new AudioContext({
      latencyHint: 'playback'  // or 'interactive' for even lower latency
    });
    
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.smoothingTimeConstant = 0.1;

    this.analyser.fftSize = 128;

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const draw = () => {
      requestAnimationFrame(draw);

      this.analyser.getByteFrequencyData(this.dataArray);

      const average = this.dataArray.reduce((a, b) => a + b, 0) / this.dataArray.length;

      // Map amplitude to radius
      const radius = Math.min(50 + average / 5, 100);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw pulsating dot
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#007bff';
      ctx.fill();
    };

    draw();
  }
  async playAudio(voiceNumber: number) {
    // Stop the previous audio if already playing
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    } 
    
    // Create and configure the audio element
    this.audio = new Audio();
    this.audio.src = `/assets/voices/audio${voiceNumber}.mp3`; // Replace with actual audio file path
    this.audio.load();

    // Connect the audio source to the analyser
    const source = this.audioContext.createMediaElementSource(this.audio);
    source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    // Play the audio
    this.audio.play().catch((error) => console.error('Audio playback error:', error));
  }
}
