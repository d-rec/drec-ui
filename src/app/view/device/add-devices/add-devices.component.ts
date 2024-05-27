import { Component } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  FormArray,
  Validators,
  FormControl,
} from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import {
  DeviceService,
  AdminService,
  OrganizationService,
} from '../../../auth/services';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import {
  OrganizationInformation,
  fulecodeType,
  devicecodeType,
  CountryInfo,
} from '../../../models';

@Component({
  selector: 'app-add-devices',
  templateUrl: './add-devices.component.html',
  styleUrls: ['./add-devices.component.scss'],
})
export class AddDevicesComponent {
  loginuser: any;
  myform: FormGroup;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
  devicetypelist: devicecodeType[] = [];
  hide = true;
  addmoredetals: any[] = [];
  shownomore: any[] = [];
  showaddmore: any[] = [];
  showerror: any[] = [];
  maxDate = new Date();
  public date: any;
  public sdgblist: any;
  public disabled = false;
  public showSpinners = true;
  public showSeconds = false;
  public touchUi = false;
  public enableMeridian = false;
  orglist: OrganizationInformation[] = [];

  public stepHour = 1;
  public stepMinute = 1;
  public stepSecond = 1;
  numberregex: RegExp = /^[0-9]+(\.[0-9]*)?$/;
  filteredCountryList: Observable<any[]>[] = [];
  subscription: Subscription;
  filteredOrgList: OrganizationInformation[] = [];
  orgname: string;
  orgId: number;
  offtaker = [
    'School',
    'Education',
    'Health Facility',
    'Residential',
    'Commercial',
    'Industrial',
    'Public Sector',
    'Agriculture',
    'Utility',
    'Off-Grid Community',
  ];
  devicedescription = [
    'Solar Lantern',
    'Solar Home System',
    'Mini Grid',
    'Rooftop Solar',
    'Ground Mount Solar',
  ];
  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private router: Router,
    private toastrService: ToastrService,
    private adminService: AdminService,
    private orgService: OrganizationService,
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {
    this.loadData();
    this.initializeForm();
    this.showinput[0] = true;
    this.addmoredetals[0] = false;
    this.showaddmore[0] = true;
    this.showerror[0] = false;
    this.shownomore[0] = false;

    setTimeout(() => {
      this.setupCountryAutocomplete(0);
    }, 1500);
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private loadData() {
    if (this.loginuser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType !== 'Buyer',
        );
        this.filteredOrgList = this.orglist;
        // Once data is loaded, call any other functions that depend on it

        this.date = new Date();
      });
    } else if (this.loginuser.role === 'ApiUser') {
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType !== 'Buyer',
        );
        // const buyerOrganizations = data.filter(org => org.organizationType === "Buyer");
        this.filteredOrgList = this.orglist;
      });
    }

    this.DisplayList();
    this.DisplaySDGBList();
    this.DisplayfuelList();
    this.DisplaytypeList();
    // Load other data as needed
  }
  filterOrgList() {
    this.filteredOrgList = this.orglist.filter((org: any) => {
      return org.name.toLowerCase().includes(this.orgname.toLowerCase());
    });
  }
  selectOrg(event: any) {
    const selectedCountry = this.orglist.find(
      (option) => option.name === event.option.value,
    );
    if (selectedCountry) {
      this.orgId = selectedCountry.id;
    }
  }
  private initializeForm() {
    this.myform = this.fb.group({
      devices: this.fb.array([]),
    });
    this.myform.valueChanges.subscribe();
    const device = this.fb.group({
      externalId: [
        null,
        [Validators.required, Validators.pattern(/^[a-zA-Z\d\-_\s]+$/)],
      ],
      projectName: [null],
      address: [null, [Validators.required]],
      latitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      longitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      countryCodename: [null, Validators.required],
      fuelCode: [null, [Validators.required]],
      deviceTypeCode: [null, [Validators.required]],
      capacity: [null, Validators.required],
      commissioningDate: [new Date(), Validators.required],
      gridInterconnection: [true],
      offTaker: [null],
      impactStory: [null],
      data: [null],
      images: [null],
      deviceDescription: [null],
      energyStorage: [true],
      energyStorageCapacity: [null],
      qualityLabels: [null],
      SDGBenefits: [[new FormControl([])]],
      version: ['1.0'],
    });
    this.deviceForms.push(device);

    // Other form initialization code
  }

  private setupCountryAutocomplete(index: number) {
    this.filteredCountryList[index] = this.getCountryCodeControl(
      index,
    ).valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '', index)),
    );
  }

  get deviceForms() {
    return this.myform.get('devices') as FormArray;
  }

  DisplayList() {
    this.authService.GetMethod('countrycode/list').subscribe((data: any) => {
      // display list in the console
      this.countrylist = data;
    });
  }
  DisplaySDGBList() {
    this.authService.GetMethod('sdgbenefit/code').subscribe((data) => {
      // display list in the console

      this.sdgblist = data;
    });
  }
  DisplayfuelList() {
    this.authService.GetMethod('device/fuel-type').subscribe((data: any) => {
      this.fuellist = data;
    });
  }
  DisplaytypeList() {
    this.authService.GetMethod('device/device-type').subscribe((data: any) => {
      this.devicetypelist = data;
    });
  }

  onSDGBRemoved(topping: string, i: number) {
    const toppings: any = this.myform.get('devices') as FormArray;
    const sdgb = toppings[i].SDGBenefits.value as string[];
    this.removeFirst(sdgb, topping);
    toppings[i].SDGBenefits.setValue(sdgb); // To trigger change detection
  }

  private removeFirst<T>(array: T[], toRemove: T): void {
    const index = array.indexOf(toRemove);
    if (index !== -1) {
      array.splice(index, 1);
    }
  }
  adddevice() {
    const device = this.fb.group({
      externalId: [
        null,
        [Validators.required, Validators.pattern(/^[a-zA-Z\d\-_\s]+$/)],
      ],
      projectName: [null],
      address: [null],
      latitude: [null, Validators.pattern(this.numberregex)],
      longitude: [null, Validators.pattern(this.numberregex)],
      countryCodename: [null, Validators.required],
      fuelCode: [null],
      deviceTypeCode: [null],
      capacity: [null, Validators.required],
      commissioningDate: [new Date(), Validators.required],
      gridInterconnection: true,
      offTaker: [null],
      impactStory: [null],
      images: [null],
      deviceDescription: [null],
      energyStorage: true,
      energyStorageCapacity: [null],
      qualityLabels: [null],
      SDGBenefits: [[new FormControl([])]],
      version: ['1.0'],
    });
    this.deviceForms.push(device);
    this.showaddmore[this.deviceForms.length - 1] = true;
    this.showinput[this.deviceForms.length - 1] = true;
    const index = this.deviceForms.length - 1;
    this.filteredCountryList[index] = this.getCountryCodeControl(
      index,
    ).valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '', index)),
    );
  }
  private _filter(value: string, i: number): CountryInfo[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.countrylist.filter((option: CountryInfo) =>
          option.country.toLowerCase().includes(filterValue),
        ).length > 0
      )
    ) {
      this.showerror[i] = true;
    } else {
      this.showerror[i] = false;
    }
    return this.countrylist.filter((code) =>
      code.country.toLowerCase().includes(filterValue),
    );
  }

  addmore(i: number) {
    this.addmoredetals[i] = true;
    this.shownomore[i] = true;
    this.showaddmore[i] = false;
  }
  nomore(i: number) {
    this.addmoredetals[i] = false;
    this.showaddmore[i] = true;
    this.shownomore[i] = false;
  }
  showinput: any[] = [];
  showenergycapacity_input(i: number, event: any) {
    if (event) {
      this.showinput[i] = true;
    } else {
      this.showinput[i] = false;
    }
  }
  deleteDevice(i: number) {
    this.deviceForms.removeAt(i);
  }

  getCountryCodeControl(index: number): FormControl {
    return this.deviceForms.at(index).get('countryCodename') as FormControl;
  }

  onSubmit() {
    const deviceArray = this.myform.value.devices;
    deviceArray.forEach((element: any) => {
      if (this.orgname != null) {
        element['organizationId'] = this.orgId;
      }
      const selectedCountry = this.countrylist.find(
        (option: CountryInfo) => option.country === element.countryCodename,
      );
      element['countryCode'] = selectedCountry?.alpha3;
      this.deviceService.Postdevices(element).subscribe({
        next: () => {
          this.toastrService.success(
            'Added Successfully !!',
            'Device! ' + element.externalId,
          );

          const index = deviceArray.indexOf(element);
          deviceArray.splice(index, 1);
          // Check if formDataArray is empty
          if (deviceArray.length === 0) {
            // Navigate to the list UI page
            if (this.loginuser.role === 'Admin') {
              this.router.navigate(['/admin/All_devices']);
            } else if (this.loginuser.role === 'ApiUser') {
              this.router.navigate(['/apiuser/All_devices']);
            } else {
              this.router.navigate(['/device/AllList']);
            }
          }
        },
        error: (err) => {
          //Error callback
          console.error('error caught in component', err.error.message);
          if (err.error.statusCode === 403) {
            this.toastrService.error('You are Unauthorized');
          } else {
            this.toastrService.error(
              'some error occurred due to ' + err.error.message,
              'Device!' + element.externalId,
            );
          }
        },
      });
    });
  }
}
