import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EMAIL_REGEX } from '../../constants';
import { AuthbaseService } from '../../auth/authbase.service';
import { CountryInfo } from '../../models';
import { IssuerService } from '../../auth/services/issuer.service';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

export interface Country {
  country: string;
}

@Component({
  standalone: false,
  selector: 'app-add-issuer',
  templateUrl: './add-issuer.component.html',
})
export class AddIssuerComponent implements OnInit {
  issuerForm: FormGroup;
  countryList: CountryInfo[] = [];
  filteredCountries: Observable<CountryInfo[]>;

  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private issuerService: IssuerService,
    private toastrService: ToastrService,
  ) {
    this.issuerForm = this.fb.group({
      name: ['', Validators.required],
      issuerId: ['', Validators.required],
      email: ['', [Validators.required, Validators.pattern(EMAIL_REGEX)]],
      country: ['', Validators.required],
      address: ['', Validators.required],
      regions: [[], Validators.required],
    });
  }

  ngOnInit() {
    this.getCountryList();
    this.filteredCountries = this.issuerForm.get('country')!.valueChanges.pipe(
      startWith(''),
      map((value) => (typeof value === 'string' ? value : value?.country)),
      map((name) => (name ? this._filter(name) : this.countryList.slice())),
    );
  }

  onSubmit() {
    if (this.issuerForm.valid) {
      const formValue = this.issuerForm.value;
      const countryAlpha3 = this.getAlpha3Code(formValue.country);
      const regionsAlpha3 = this.getRegionsAlpha3(formValue.regions);

      const payload = {
        ...formValue,
        country: countryAlpha3,
        regions: regionsAlpha3,
      };

      this.issuerService.createIssuer(payload).subscribe(
        () => {
          this.toastrService.success('Issuer created successfully');
          this.issuerForm.reset();
        },
        (error) => {
          this.toastrService.error(
            'Error creating issuer',
            error.error.message,
          );
        },
      );
    }
  }

  getCountryList() {
    this.authService.GetMethod('countrycode/list').subscribe((data: any) => {
      this.countryList = Array.isArray(data) ? data : [];
    });
  }

  onCountrySelected(event: MatAutocompleteSelectedEvent): void {
    const selectedCountry = this.countryList.find(
      (c) => c.country === event.option.value,
    );
    if (selectedCountry) {
      this.issuerForm.patchValue({
        country: selectedCountry.country,
      });
    }
  }

  getCountryDisplayName(country: CountryInfo | string): string {
    if (!country) return '';
    if (typeof country === 'string') {
      return country;
    }
    return country.country || '';
  }

  private _filter(name: string): CountryInfo[] {
    const filterValue = name.toLowerCase();
    return this.countryList.filter((option) =>
      option.country.toLowerCase().includes(filterValue),
    );
  }

  private getAlpha3Code(country: string | CountryInfo): string {
    if (!country) return '';
    if (typeof country === 'string') {
      const found = this.countryList.find(
        (option) => option.country === country,
      );
      return found?.alpha3 || country;
    }
    return country.alpha3 || country.country;
  }

  private getRegionsAlpha3(regionNames: string[] = []): string[] {
    return regionNames.map((regionName) => this.getAlpha3Code(regionName));
  }
}
