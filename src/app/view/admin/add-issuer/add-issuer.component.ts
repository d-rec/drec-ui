import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EMAIL_REGEX } from '../../../../app/constants';
import { Observable, startWith } from 'rxjs';
import { AuthbaseService } from '../../../auth/authbase.service';
import { CountryInfo } from '../../../models';
import { IssuerService } from '../../../auth/services/issuer.service';

@Component({
  selector: 'app-add-issuer',
  templateUrl: './add-issuer.component.html',
})
export class AddIssuerComponent implements OnInit {
  issuerForm: FormGroup;
  countryList: CountryInfo[] = [];
  filteredCountries$: Observable<CountryInfo[]>;

  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private issuerService: IssuerService,
  ) {
    this.issuerForm = this.fb.group({
      name: ['', Validators.required],
      issuerId: ['', Validators.required],
      email: ['', [Validators.required, Validators.pattern(EMAIL_REGEX)]],
      country: ['', Validators.required],
      address: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.getCountryList();
    // Setup autocomplete after countryList is loaded
    this.issuerForm
      .get('country')!
      .valueChanges.pipe(startWith(''))
      .subscribe((value) => {
        this.filteredCountries$ = this.filterCountries(value || '');
      });
  }

  onSubmit() {
    if (this.issuerForm.valid) {
      const selectedCountry = this.countryList.find(
        (option: CountryInfo) =>
          option.country === this.issuerForm.value.country,
      );
      if (selectedCountry) {
        this.issuerForm.patchValue({ country: selectedCountry.alpha3 });
      }
      this.issuerService.createIssuer(this.issuerForm.value).subscribe(
        (response) => {
          // Handle successful response
          console.log('Issuer created successfully:', response);
        },
        (error) => {
          // Handle error response
          console.error('Error creating issuer:', error);
        },
      );
    }
  }

  private filterCountries(value: string): Observable<CountryInfo[]> {
    const filterValue = value.toLowerCase();
    return new Observable<CountryInfo[]>((observer) => {
      observer.next(
        this.countryList.filter((option) =>
          option.country.toLowerCase().includes(filterValue),
        ),
      );
      observer.complete();
    });
  }

  getCountryList() {
    this.authService.GetMethod('countrycode/list').subscribe((data: any) => {
      this.countryList = data;
      // Initialize filteredCountries$ with all countries
      this.filteredCountries$ = this.filterCountries('');
    });
  }
}
