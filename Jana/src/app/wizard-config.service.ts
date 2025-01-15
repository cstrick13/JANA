import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WizardConfigService {
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
}
