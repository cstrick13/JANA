import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WizardConfigService {
  public selectedAudioSrc?: string;
  public userName?: string;
  public commandWord?: string;
  private _wizardFinished = false;
  private config = {
    outputPath: '',
    terminalPath: ''
  };

  getConfig() {
    return this.config;
  }

  setConfig(outputPath: string, terminalPath: string) {
    this.config.outputPath = outputPath;
    this.config.terminalPath = terminalPath;
  }

  constructor() {
    // On app start, try loading wizardFinished from localStorage
    const storedValue = localStorage.getItem('wizardFinished');
    if (storedValue !== null) {
      this._wizardFinished = JSON.parse(storedValue) === true;
    }
  }

  get wizardFinished(): boolean {
    return this._wizardFinished;
  }

  // Provide a setter that updates both the service field and localStorage
  set wizardFinished(value: boolean) {
    this._wizardFinished = value;
    localStorage.setItem('wizardFinished', JSON.stringify(value));
  }
  
}
