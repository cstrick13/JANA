import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';


@Component({
  selector: 'app-wizard-2',
  standalone: true,
  imports: [CommonModule, RouterOutlet,RouterModule],
  templateUrl: './wizard-2.component.html',
  styleUrl: './wizard-2.component.css'
})
export class Wizard2Component {
  playAudio() {
    try {
      const audio = new Audio('/assets/voices/audio1.mp3'); // Ensure the path is correct
      audio.play();
      console.log('Audio file is playing.');
    } catch (error) {
      console.error('Failed to play audio file:', error);
    }
  }
  playAudio2() {  
    try {
      const audio = new Audio('/assets/voices/audio2.mp3'); // Ensure the path is correct
      audio.play();
      console.log('Audio file is playing.');
    } catch (error) {
      console.error('Failed to play audio file:', error);
    }
  }

  playAudio3() {  
    try {
      const audio = new Audio('/assets/voices/audio3.mp3'); // Ensure the path is correct
      audio.play();
      console.log('Audio file is playing.');
    } catch (error) {
      console.error('Failed to play audio file:', error);
    }
  }
  playAudio4() {  
    try {
      const audio = new Audio('/assets/voices/audio4.mp3'); // Ensure the path is correct
      audio.play();
      console.log('Audio file is playing.');
    } catch (error) {
      console.error('Failed to play audio file:', error);
    }
  }
}
