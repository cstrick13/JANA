import { TestBed } from '@angular/core/testing';

import { WizardConfigService } from './wizard-config.service';

describe('WizardConfigService', () => {
  let service: WizardConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WizardConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
