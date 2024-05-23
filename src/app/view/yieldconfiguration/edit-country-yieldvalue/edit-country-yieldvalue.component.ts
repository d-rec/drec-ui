import { Component } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { YieldConfigurationService } from '../../../auth/services/yieldConfiguration.service';
@Component({
  selector: 'app-edit-country-yieldvalue',
  templateUrl: './edit-country-yieldvalue.component.html',
  styleUrls: ['./edit-country-yieldvalue.component.scss'],
})
export class EditCountryYieldvalueComponent {
  subscription: Subscription;
  countrylist: any;
  countrycodeLoded: boolean = false;
  filteredOptions: Observable<any[]>;
  updayeyieldForm: FormGroup;
  showerror: boolean = false;
  yieldid: number;
  countryName: string;
  countryCode: string;
  yieldValue: number;
  status: boolean;
  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private yieldService: YieldConfigurationService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
  ) {
    this.yieldid = this.activatedRoute.snapshot.params['id'];
  }

  ngOnInit() {
    this.authService.GetMethod('countrycode/list').subscribe((data3: any) => {
      this.countrylist = data3;
      this.countrycodeLoded = true;
    });
    this.updayeyieldForm = this.fb.group({
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
    this.getYieldinfo();
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  applycountryFilter() {
    this.updayeyieldForm.controls['countryName'];
    this.filteredOptions = this.updayeyieldForm.controls[
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
        this.updayeyieldForm.controls['countryCode'].setValue(
          selectedCountry.alpha3,
        );
      }
    });
  }
  getYieldinfo() {
    this.yieldService.getyieldInfoById(this.yieldid).subscribe((data) => {
      this.countryName = data.countryName;
      this.countryCode = data.countryCode;
      this.updayeyieldForm.controls['countryCode'].setValue(this.countryCode);
      this.yieldValue = data.yieldValue;
      if (data.status === 'Y') {
        this.status = true;
      } else if (data.status === 'N') {
        this.status = false;
      }
    });
  }
  onSubmit() {
    if (this.updayeyieldForm.value.status) {
      this.updayeyieldForm.controls['status'].setValue('Y');
    } else {
      this.updayeyieldForm.controls['status'].setValue('N');
    }
    this.yieldService
      .PatchYieldInfo(this.yieldid, this.updayeyieldForm.value)
      .subscribe({
        next: (data) => {
          if (data) {
            this.updayeyieldForm.reset();
            const formControls = this.updayeyieldForm.controls;
            Object.keys(formControls).forEach((key) => {
              const control = formControls[key];
              control.setErrors(null);
            });
            this.router.navigate(['/admin/yield/list']);
            this.toastrService.success(
              'Successfully!!',
              'Yield Value Updated ',
            );
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
