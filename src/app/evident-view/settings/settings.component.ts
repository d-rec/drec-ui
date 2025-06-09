import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EvidentService } from '../../auth/services/evident.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  settingsForm: FormGroup;

  constructor(
    private evidentService: EvidentService,
    private toastrService: ToastrService,
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

  checkValidation(input: string) {
    const validation =
      this.settingsForm.get(input)?.invalid &&
      (this.settingsForm.get(input)?.dirty ||
        this.settingsForm.get(input)?.touched);
    return validation;
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
