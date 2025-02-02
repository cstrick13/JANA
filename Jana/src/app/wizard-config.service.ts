import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WizardConfigService {
  public selectedAudioSrc?: string;
  public userName?: string;
  public commandWord?: string;
  private _wizardFinished = false;
  public config = {
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
    const storedValue = localStorage.getItem('wizardFinished');
    console.log('Stored wizardFinished:', storedValue);
    if (storedValue !== null) {
      this._wizardFinished = JSON.parse(storedValue) === true;
    }
    console.log('After constructor, _wizardFinished =', this._wizardFinished);
  }

  get wizardFinished(): boolean {
    return this._wizardFinished;
  }

  // Provide a setter that updates both the service field and localStorage
  set wizardFinished(value: boolean) {
    console.log('Setting wizardFinished to:', value);
    this._wizardFinished = value;
    localStorage.setItem('wizardFinished', JSON.stringify(value));
  }
  
}
