import { FormBuilder, FormGroup } from '@angular/forms';
import { Component, Inject, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';

import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { AuthbaseService } from '../../../auth/authbase.service';
import { DeviceService, OrganizationService } from '../../../auth/services';
import { Router } from '@angular/router';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import {
  MatDialog,
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DeviceDetailsComponent } from '../device-details/device-details.component';
import { ToastrService } from 'ngx-toastr';
import { fulecodeType, devicecodeType, CountryInfo } from '../../../models';

@Component({
  selector: 'app-alldevices',
  templateUrl: './alldevices.component.html',
  styleUrls: ['./alldevices.component.scss'],
})
export class AlldevicesComponent {
  title = 'matDialog';
  dataFromDialog: any;
  displayedColumns = [
    'onboarding_date',
    // 'projectName',
    'externalId',
    'internalexternalId',
    'countryCode',
    // 'fuelCode',
    'commissioningDate',
    'capacity',
    // 'SDGBenefits',
    'actions',
  ];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  data: any;
  loginuser: any;
  deviceurl: any;
  pageSize: number = 20;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
  devicetypelist: devicecodeType[] = [];
  fuellistLoaded: boolean = false;
  devicetypeLoded: boolean = false;
  countrycodeLoded: boolean = false;
  loading: boolean = true;
  public sdgblist: any;
  FilterForm: FormGroup;
  p: number = 1;
  totalRows = 0;
  filteredOptions: Observable<any[]>;
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
  endminDate = new Date();
  totalPages: number;
  subscription: Subscription;
  selectedCountry: any;
  isAnyFieldFilled: boolean = false;
  showerror: boolean = false;
  showlist: boolean = false;
  orglist: any;
  orgname: string;
  orgId: number;
  filteredOrgList: Observable<any[]>;
  constructor(
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private orgService: OrganizationService,
    private toastrService: ToastrService,
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.FilterForm = this.formBuilder.group({
      countryCode: [],
      countryname: [],
      fuelCode: [],
      deviceTypeCode: [],
      capacity: [],
      offTaker: [],
      SDGBenefits: [],
      start_date: [null],
      end_date: [null],
      //pagenumber: [this.p]
    });
  }
  ngOnInit(): void {
    if (this.loginuser.role === 'ApiUser') {
      this.FilterForm.addControl(
        'organizationname',
        this.formBuilder.control(''),
      );
      this.FilterForm.addControl(
        'organizationId',
        this.formBuilder.control(''),
      );
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org) => org.organizationType != 'Buyer',
        );
      });
    }
    this.authService.GetMethod('device/fuel-type').subscribe((data1: any) => {
      this.fuellist = data1;
      this.fuellistLoaded = true;
    });
    this.authService.GetMethod('device/device-type').subscribe((data2: any) => {
      this.devicetypelist = data2;
      this.devicetypeLoded = true;
    });
    this.authService.GetMethod('countrycode/list').subscribe((data3: any) => {
      this.countrylist = data3;
      this.countrycodeLoded = true;
    });
    this.authService.GetMethod('sdgbenefit/code').subscribe((data) => {
      this.sdgblist = data;
    });

    setTimeout(() => {
      if (this.countrycodeLoded) {
        this.applycountryFilter();
      }
      if (this.loginuser.role === 'ApiUser') {
        this.applyorgFilter();
      }
      this.loading = false;
      this.getDeviceListData(this.p);
    }, 2000);
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  applyorgFilter() {
    this.FilterForm.controls['organizationname'];
    this.filteredOrgList = this.FilterForm.controls[
      'organizationname'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._orgfilter(value || '')),
    );
  }
  private _orgfilter(value: any): string[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.orglist.filter((option: any) =>
          option.name.toLowerCase().includes(filterValue),
        ).length > 0
      )
    ) {
      // this.showorgerror = true;
      // const updatedFormValues = this.FilterForm.value;
      // const isAllValuesNull = Object.values(this.FilterForm.value).some((value) => !!value);
      // this.isAnyFieldFilled = false;
    } else {
      //this.showorgerror = false;
    }
    return this.orglist.filter(
      (option: any) =>
        option.name.toLowerCase().indexOf(filterValue.toLowerCase()) === 0,
    );
  }
  applycountryFilter() {
    this.FilterForm.controls['countryname'];
    this.filteredOptions = this.FilterForm.controls[
      'countryname'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '')),
    );
  }

  private _filter(value: any): CountryInfo[] {
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

  checkFormValidity(): void {
    const isUserInteraction = true; // Flag to track user interaction

    this.FilterForm.valueChanges
      .pipe(
        debounceTime(500), // Debounce the stream for 500 milliseconds
      )
      .subscribe((formValues) => {
        if (isUserInteraction) {
          const countryValue = formValues.countryname;
          if (countryValue === undefined || countryValue === '') {
            this.FilterForm.controls['countryname'].setValue(null);
            this.FilterForm.controls['countryCode'].setValue(null);
          }
          const fuelCodeValue = formValues.fuelCode;
          if (fuelCodeValue === undefined) {
            this.FilterForm.controls['fuelCode'].setValue(null);
          }
          if (
            formValues.offTaker != null &&
            formValues.offTaker[0] === undefined
          ) {
            this.FilterForm.controls['offTaker'].setValue(null);
          }
          if (
            formValues.deviceTypeCode != null &&
            formValues.deviceTypeCode[0] === undefined
          ) {
            this.FilterForm.controls['deviceTypeCode'].setValue(null);
          }
          if (
            formValues.SDGBenefits != null &&
            formValues.SDGBenefits[0] === undefined
          ) {
            this.FilterForm.controls['SDGBenefits'].setValue(null);
          }
          // Other code...
        }
      });

    setTimeout(() => {
      const updatedFormValues = this.FilterForm.value;
      const isAllValuesNull = Object.values(updatedFormValues).some(
        (value) => !!value,
      );
      this.isAnyFieldFilled = isAllValuesNull;
      if (!this.isAnyFieldFilled) {
        this.getDeviceListData(this.p);
      }
    }, 500);

    // Other code...
  }
  selectorg(event: any) {
    this.subscription = this.filteredOrgList.subscribe((options) => {
      const selectedorg = options.find(
        (option) => option.name === event.option.value,
      );
      if (selectedorg) {
        this.FilterForm.controls['organizationId'].setValue(selectedorg.id);
      }
    });
  }
  selectCountry(event: any) {
    this.subscription = this.filteredOptions.subscribe((options) => {
      const selectedCountry = options.find(
        (option) => option.country === event.option.value,
      );
      if (selectedCountry) {
        this.FilterForm.controls['countryCode'].setValue(
          selectedCountry.alpha3,
        );
      }
    });
  }

  reset() {
    this.FilterForm.reset();
    this.FilterForm.controls['countryCode'].setValue(null);
    this.loading = false;
    this.isAnyFieldFilled = false;
    this.p = 1;
    this.getDeviceListData(this.p);
  }

  onEndChangeEvent(event: any) {
    this.endminDate = event;
  }

  DisplayListFilter() {
    this.p = 1;
    this.getDeviceListData(this.p);
  }

  getDeviceListData(page: number) {
    this.deviceurl = 'device/my?';

    this.deviceService
      .GetMyDevices(this.deviceurl, this.FilterForm.value, page)
      .subscribe({
        next: (data) => {
          this.showlist = true;

          if (data.devices) {
            this.loading = false;

            this.data = data;
            this.DisplayList();
          }
        },
        error: (err) => {
          console.log(err);
          if (err.error.statusCode === 403) {
            this.toastrService.error(
              "You don't have the permissions to access the devices.",
              'Access Denied',
            );
          } else {
            this.toastrService.error('Error', err.error.message);
          }
          this.data = [];
          this.showlist = false;
        },
      });
  }

  DisplayList() {
    if (
      this.fuellistLoaded == true &&
      this.devicetypeLoded == true &&
      this.countrycodeLoded === true
    ) {
      this.data.devices.forEach((ele: any) => {
        ele['fuelname'] = this.fuellist.find(
          (fuelType) => fuelType.code === ele.fuelCode,
        )?.name;

        ele['devicetypename'] = this.devicetypelist.find(
          (devicetype) => devicetype.code == ele.deviceTypeCode,
        )?.name;

        ele['countryname'] = this.countrylist.find(
          (countrycode) => countrycode.alpha3 == ele.countryCode,
        )?.country;
      });

      this.dataSource = new MatTableDataSource(this.data.devices);
      this.totalRows = this.data.totalCount;
      this.totalPages = this.data.totalPages;
      // this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    }
  }
  UpdateDevice(externalId: any) {
    this.router.navigate(['/device/edit/' + externalId], {
      queryParams: { fromdevices: true },
    });
  }

  previousPage(): void {
    if (this.p > 1) {
      this.p--;
      this.getDeviceListData(this.p);
    }
  }

  nextPage(): void {
    if (this.p < this.totalPages) {
      this.p++;
      this.getDeviceListData(this.p);
    }
  }
  // showPrompt(deviceId:number): void {
  //   const dialogRef = this.dialog.open(DeviceDetailsComponent, {
  //     width: '500px',
  //     height: '400px',
  //   });

  //   dialogRef.afterClosed().subscribe((data) => {
  //     this.dataFromDialog = data.form;
  //     if (data.clicked === 'submit') {
  //     }
  //   });
  // }
  alertDialog(deviceId: number): void {
    this.dialog.open(DeviceDetailsComponent, {
      data: {
        deviceid: deviceId,
      },
      width: '900px',
      height: '400px',
    });
  }

  openDialog(device: any) {
    const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirm Remove Device',
        message:
          'Are you sure, you want to remove Device: ' + device.externalId,
      },
    });
    confirmDialog.afterClosed().subscribe((result) => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
        this.deleteDevice(device.id);
      }
    });
  }

  deleteDevice(id: number) {
    this.deviceService.RemoveDevice(id).subscribe((response) => {
      if (response.success) {
        this.toastrService.success(response.message, 'Successfully');
        this.getDeviceListData(this.p);
      } else {
        this.toastrService.error(response.message, 'Failure');
      }
    });
  }
}

@Component({
  selector: 'deviceremove_dialog',
  templateUrl: 'deviceremove_dialog.html',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
})
export class ConfirmDialogComponent {
  title: string;
  message: string;
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}
}
