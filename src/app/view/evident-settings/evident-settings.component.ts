import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EvidentService } from '../../auth/services/evident.service';
import { ToastrService } from 'ngx-toastr';
import { EMAIL_REGEX } from '../../../app/constants';

export enum IssuanceRequestFrequency {
  Monthly = 'Monthly',
  Quarterly = 'Quarterly',
  SemiAnnually = 'Semi-Annually',
}

@Component({
  selector: 'app-settings',
  templateUrl: './evident-settings.component.html',
  styleUrls: ['./evident-settings.component.scss'],
})
export class EvidentSettingsComponent implements OnInit {
  settingsForm: FormGroup;
  issuanceFrequencies = Object.values(IssuanceRequestFrequency);
  constructor(
    private evidentService: EvidentService,
    private toastrService: ToastrService,
    private fb: FormBuilder,
  ) {
    this.settingsForm = this.fb.group({
      apiKey: ['', Validators.required],
      email: ['', [Validators.required, Validators.pattern(EMAIL_REGEX)]],
      defaultTradingAccount: ['', Validators.required],
      defaultBeneficiaryAccount: '',
      frequency: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.getInitialSettings();
  }

  checkValidation(input: string) {
    const validation =
      this.settingsForm.get(input)?.invalid &&
      (this.settingsForm.get(input)?.dirty ||
        this.settingsForm.get(input)?.touched);
    return validation;
  }

  emailErrors() {
    return this.settingsForm.get('email')?.hasError('required')
      ? 'Evident is required'
      : this.settingsForm.get('email')?.hasError('pattern')
        ? 'Not a valid email address'
        : '';
  }

  getInitialSettings(): void {
    this.evidentService.getSettings().subscribe({
      next: (data) => {
        if (data) {
          this.settingsForm.patchValue({
            apiKey: data.apiKey || '',
            email: data.email || '',
            defaultTradingAccount: data.defaultTradingAccount || '',
            defaultBeneficiaryAccount: data.defaultBeneficiaryAccount || '',
            frequency: data.frequency || '',
          });
        }
      },
      error: (err) => {
        this.toastrService.error('Failed to load settings' + err);
        console.error('Failed to load settings', err);
      },
    });
  }

  onSubmit(): void {
    if (this.settingsForm.valid) {
      this.evidentService.saveSettings(this.settingsForm.value).subscribe({
        next: () => {
          this.toastrService.success('Settings saved successfully');
          this.settingsForm.reset();
        },
        error: (err) => {
          this.toastrService.error('Failed to save settings' + err);
          console.error('Error submitting settings:', err);
        },
      });
    }
  }
  onCancel(): void {
    this.getInitialSettings();
  }
}
