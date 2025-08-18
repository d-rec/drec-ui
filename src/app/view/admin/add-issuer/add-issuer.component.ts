import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-add-issuer',
  templateUrl: './add-issuer.component.html',
})
export class AddIssuerComponent {
  issuerForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.issuerForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      organization: ['', Validators.required],
    });
  }

  onSubmit() {
    if (this.issuerForm.valid) {
      // Handle form submission logic here
      console.log('Issuer registration data:', this.issuerForm.value);
    }
  }
}
