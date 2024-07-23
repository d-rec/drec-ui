import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { YieldConfigurationService } from '../../../auth/services/yieldConfiguration.service';
@Component({
  selector: 'app-add-country-yieldvalue',
  templateUrl: './add-country-yieldvalue.component.html',
  styleUrls: ['./add-country-yieldvalue.component.scss'],
})
export class AddCountryYieldvalueComponent {
  subscription: Subscription;
  countrylist: any;
  countrycodeLoded: boolean = false;
  filteredOptions: Observable<any[]>;
  yieldForm: FormGroup;
  showerror: boolean = false;
  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private yieldService: YieldConfigurationService,
    private router: Router,
    private toastrService: ToastrService,
  ) {}

  ngOnInit() {
    this.authService.GetMethod('countrycode/list').subscribe((data3: any) => {
      this.countrylist = data3;
      this.countrycodeLoded = true;
    });
    this.yieldForm = this.fb.group({
      countryName: [null, Validators.required],
      countryCode: [null],
      yieldValue: [null, Validators.required],
      status: [true, Validators.required],
    });
    setTimeout(() => {
      if (this.countrycodeLoded) {
        this.applycountryFilter();
      }
      // this.displayList(this.p);
    }, 2000);
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  applycountryFilter() {
    this.yieldForm.controls['countryName'];
    this.filteredOptions = this.yieldForm.controls[
      'countryName'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '')),
    );
  }
  private _filter(value: any): string[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.countrylist.filter((option: any) =>
          option.country.toLowerCase().includes(filterValue),
        ).length > 0
      )
    ) {
      this.showerror = true;
    } else {
      this.showerror = false;
    }
    return this.countrylist.filter(
      (option: any) =>
        option.country.toLowerCase().indexOf(filterValue.toLowerCase()) === 0,
    );
  }
  selectCountry(event: any) {
    this.subscription = this.filteredOptions.subscribe((options) => {
      const selectedCountry = options.find(
        (option) => option.country === event.option.value,
      );
      if (selectedCountry) {
        this.yieldForm.controls['countryCode'].setValue(selectedCountry.alpha3);
      }
    });
  }
  onSubmit() {
    if (this.yieldForm.value.status) {
      this.yieldForm.controls['status'].setValue('Y');
    } else {
      this.yieldForm.controls['status'].setValue('N');
    }
    this.yieldService.addYield(this.yieldForm.value).subscribe({
      next: (data) => {
        if (data) {
          this.yieldForm.reset();
          const formControls = this.yieldForm.controls;
          Object.keys(formControls).forEach((key) => {
            const control = formControls[key];
            control.setErrors(null);
          });
          this.router.navigate(['/admin/yield/list']);
          this.toastrService.success('Successfully!!', 'Yield Value added ');
        }
      },
      error: (err) => {
        //Error callback
        console.error('error caught in component', err);
        this.toastrService.error('error!', err.error.message);
      },
    });
  }
}
