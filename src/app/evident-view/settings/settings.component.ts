import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EvidentService } from '../../auth/services/evident.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  settingsForm: FormGroup;

  constructor(
    private evidentService: EvidentService,
    private fb: FormBuilder,
  ) {
    this.settingsForm = this.fb.group({
      apiKey: ['', Validators.required],
      defaultTradingAccount: ['', Validators.required],
      defaultBeneficiaryAccount: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.getInitialSettings();
  }

  get apiKey() {
    return this.settingsForm.get('apiKey')!;
  }

  get defaultTradingAccount() {
    return this.settingsForm.get('defaultTradingAccount')!;
  }

  get defaultBeneficiaryAccount() {
    return this.settingsForm.get('defaultBeneficiaryAccount')!;
  }

  getInitialSettings(): void {
    this.evidentService.getSettings().subscribe({
      next: (data) => {
        if (data) {
          this.settingsForm.patchValue({
            apiKey: data.apiKey || '',
            defaultTradingAccount: data.defaultTradingAccount || '',
            defaultBeneficiaryAccount: data.defaultBeneficiaryAccount || '',
          });
        }
      },
      error: (err) => {
        console.error('Failed to load settings', err);
      },
    });
  }

  onSubmit(): void {
    if (this.settingsForm.valid) {
      this.evidentService.saveSettings(this.settingsForm.value).subscribe({
        next: () => {
          this.settingsForm.reset();
        },
        error: (err) => {
          console.error('Error submitting settings:', err);
        },
      });
    }
  }
}
