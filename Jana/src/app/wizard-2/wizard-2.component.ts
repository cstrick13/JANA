import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-wizard-2',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  templateUrl: './wizard-2.component.html',
  styleUrl: './wizard-2.component.css'
})
export class Wizard2Component implements OnInit {
  private audioContext!: AudioContext;
  private analyser!: AnalyserNode;
  private dataArray!: Uint8Array;
  private audio!: HTMLAudioElement;

  /** 
   * Flag to detect if we're dealing with a short clip. 
   * (For an extra visual "boost") 
   */
  private isShortClip = false;

  ngOnInit() {
    this.setupAudioVisualizer();
  }

  setupAudioVisualizer() {
    const canvas = document.getElementById('pulse-dot') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');

    if (!ctx) {
      console.error('Canvas context not found');
      return;
    }

    canvas.width = 200;
    canvas.height = 200;

    // 1) Initialize AudioContext
    this.audioContext = new AudioContext({
      latencyHint: 'interactive' // lower-latency setting
    });

    // 2) Create AnalyserNode with lower smoothing
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 64;              // smaller for quicker response
    this.analyser.smoothingTimeConstant = 0.2; // no smoothing for short bursts

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    // 3) Animation loop
    const draw = () => {
      requestAnimationFrame(draw);

      // Get frequency data
      this.analyser.getByteFrequencyData(this.dataArray);

      // Calculate max + average to emphasize quick peaks
      const maxVal = Math.max(...this.dataArray);
      const avgVal = this.dataArray.reduce((a, b) => a + b, 0) / this.dataArray.length;
      let amplitude = (maxVal + avgVal) / 2;

      // Optionally boost if it's a short clip
      if (this.isShortClip) {
        amplitude *= 1.5; // tweak this factor as you like
      }

      // Convert amplitude to a radius
      const radius = Math.min(50 + amplitude / 5, 100);

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
    // Stop any previously playing audio
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }

    // Resume AudioContext if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Create a new audio element
    this.audio = new Audio();
    this.audio.src = `/assets/voices/audio${voiceNumber}.mp3`;
    this.audio.load();

    // Check duration when metadata is available
    this.audio.addEventListener('loadedmetadata', () => {
      // Mark as short clip if under 1.5 seconds (example threshold)
      this.isShortClip = this.audio.duration < 1.5;
    });

    // Connect the source to the analyser + output
    const source = this.audioContext.createMediaElementSource(this.audio);
    source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    // Play the audio
    this.audio.play().catch((err) => console.error('Audio playback error:', err));
  }
}
