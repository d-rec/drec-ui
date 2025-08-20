import { SelectionModel } from '@angular/cdk/collections';
import { Component, ViewChild, TemplateRef, Input } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { AuthbaseService } from '../../auth/authbase.service';
import { Router } from '@angular/router';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import {
  DeviceService,
  ReservationService,
  OrganizationService,
} from '../../auth/services';
import { MatDialog } from '@angular/material/dialog';
import {
  MatBottomSheet,
  MatBottomSheetConfig,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MeterReadTableComponent } from '../meter-read/meter-read-table/meter-read-table.component';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DeviceDetailsComponent } from '../device/device-details/device-details.component';
import {
  OrganizationInformation,
  Device,
  fulecodeType,
  devicecodeType,
  CountryInfo,
} from '../../models';
import { GroupType, SelectionType } from 'src/app/utils/drec.enum';
@Component({
  selector: 'app-add-device-group',
  templateUrl: './add-device-group.component.html',
  styleUrls: ['./add-device-group.component.scss'],
})
export class AddDeviceGroupComponent {
  @Input() selectionType: SelectionType.Checkbox | SelectionType.Radio =
    SelectionType.Checkbox;
  @Input() headerText: string = 'Make a Device Group';
  displayedColumns = [
    'select',
    'onboarding_date',
    'projectName',
    'externalId',
    'internalexternalId',
    'countryCode',
    'commissioningDate',
    'status',
    'viewread',
  ];
  bottomSheetRef = {} as MatBottomSheetRef<MeterReadTableComponent>;
  @ViewChild('mypopupDialog') popupDialog = {} as TemplateRef<any>;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  data: Device[] = [];
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
  selection = new SelectionModel<any>(true, []);
  reservationForm: FormGroup;
  filteredOptions: Observable<any[]>;
  endminDate = new Date();
  filterendminDate = new Date();
  FilterForm: FormGroup;
  p: number = 1;
  totalRows = 0;
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
  frequency = ['hourly', 'daily', 'weekly', 'monthly'];
  dialogRef: any;
  sdgblist: any;
  totalPages: number;
  subscription: Subscription;
  isAnyFieldFilled: boolean = false;
  showerror: boolean = false;
  orgname: string;
  orgId: number;
  orglist: OrganizationInformation[] = [];
  filteredOrgList: OrganizationInformation[] = [];
  reservationbollean = {
    continewwithunavilableonedevice: true,
    continueWithTCLessDTC: true,
  };
  selectedOrganization: any;
  constructor(
    private authService: AuthbaseService,
    private reservationService: ReservationService,
    private router: Router,
    public dialog: MatDialog,
    private bottomSheet: MatBottomSheet,
    private formBuilder: FormBuilder,
    private toastrService: ToastrService,
    private deviceservice: DeviceService,
    private orgService: OrganizationService,
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.reservationForm = this.formBuilder.group({
      name: [null, Validators.required],
      deviceIds: [Validators.required],
      targetCapacityInMegaWattHour: [null, Validators.required],
      reservationStartDate: [null, Validators.required],
      reservationEndDate: [null, Validators.required],
      reservationExpiryDate: [null],
      continueWithReservationIfOneOrMoreDevicesUnavailableForReservation: [
        true,
      ],
      continueWithReservationIfTargetCapacityIsLessThanDeviceTotalCapacityBetweenDuration:
        [true],
      authorityToExceed: [true],
      frequency: [null, Validators.required],
      // blockchainAddress: [null]
    });
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
    });

    this.FilterForm.valueChanges.subscribe(() => {
      this.isAnyFieldFilled = Object.values(this.FilterForm.value).some(
        (value) => value !== null,
      );
    });
  }
  ngOnInit() {
    if (this.loginuser.role === 'ApiUser') {
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org: OrganizationInformation) =>
            org.organizationType === 'Developer',
        );
        this.filteredOrgList = this.orglist;
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
    this.authService.GetMethod('sdgbenefit/code').subscribe((data) => {
      // display list in the console
      this.sdgblist = data;
    });
    this.authService.GetMethod('countrycode/list').subscribe((data3: any) => {
      this.countrylist = data3;
      this.countrycodeLoded = true;
    });

    setTimeout(() => {
      if (this.countrycodeLoded) {
        this.applycountryFilter();
      }
      this.displayList(this.p);
    }, 2000);
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  selectSingleDevice(row: Device) {
    this.selection.clear();
    this.selection.select(row);
  }

  filterOrgList() {
    this.filteredOrgList = this.orglist.filter((org: any) => {
      return org.name.toLowerCase().includes(this.orgname.toLowerCase());
    });
  }
  selectOrg(event: any) {
    this.selectedOrganization = this.orglist.find(
      (option) => option.name === event.option.value,
    );
    if (this.selectedOrganization) {
      this.orgId = this.selectedOrganization.id;
      if (this.selectionType === SelectionType.Checkbox) {
        this.deviceservice
          .getfilterData({}, this.selectedOrganization.id, 1)
          .subscribe((data) => {
            this.updateDeviceTable(
              data.devices,
              data.totalCount,
              data.totalPages,
            );
          });
      } else {
        this.ungroupedDevicesForOrg(this.selectedOrganization.id);
      }
    }
  }
  ungroupedDevicesForOrg(orgId?: number) {
    this.deviceservice.getAllUngroupedDevices(orgId).subscribe((data) => {
      data = data.flatMap((group: any) => group.devices);
      const pageSize = 10;
      const totalCount = data.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      this.loading = false;
      this.updateDeviceTable(data, totalCount, totalPages);
    });
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
          // const fuelCodeValue = formValues.fuelCode;
          // if (fuelCodeValue != null && fuelCodeValue === undefined) {
          //   this.FilterForm.controls['fuelCode'].setValue(null);
          // }
          if (
            formValues.deviceTypeCode != null &&
            formValues.deviceTypeCode[0] === undefined
          ) {
            this.FilterForm.controls['deviceTypeCode'].setValue(null);
          }
          if (
            formValues.offTaker != null &&
            formValues.offTaker[0] === undefined
          ) {
            this.FilterForm.controls['offTaker'].setValue(null);
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
        this.displayList(this.p);
      }
    }, 500);

    // Other code...
  }
  openBottomSheet(device: any) {
    if (
      this.reservationForm.value.reservationStartDate != null &&
      this.reservationForm.value.reservationEndDate != null
    ) {
      const requestreaddata: any = {
        devicename: device.externalId,
        rexternalid: device.id,
        reservationStartDate: this.reservationForm.value.reservationStartDate,
        reservationEndDate: this.reservationForm.value.reservationEndDate,
      };
      const config: MatBottomSheetConfig = { data: requestreaddata };
      this.bottomSheetRef = this.bottomSheet.open(
        MeterReadTableComponent,
        config,
      );
      this.bottomSheetRef.afterOpened().subscribe(() => {});
      this.bottomSheetRef.afterDismissed().subscribe(() => {});
    } else {
      this.toastrService.error('Validation!', 'Please add start and end date');
    }
  }
  reset() {
    this.FilterForm.reset();
    this.FilterForm.controls['countryCode'].setValue(null);
    this.loading = false;
    this.p = 1;
    this.selection.clear();
    this.displayList(this.p);
    this.isAnyFieldFilled = false;
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }
  masterToggle() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.dataSource.data.forEach((row) => this.selection.select(row));
  }
  onEndChangeEvent(event: any) {
    this.endminDate = event;
  }
  expiryminDate = new Date();
  onExpiryEvent(event: any) {
    this.expiryminDate = event;
  }
  onfilterEndChangeEvent(event: any) {
    this.filterendminDate = event;
  }
  // getcountryListData() {

  // }

  applyFilter() {
    this.loading = true;
    this.p = 1;
    this.displayList(this.p);
  }
  displayList(page: number) {
    if (this.selectionType === SelectionType.Checkbox) {
      this.deviceservice
        .getfilterData(this.FilterForm.value, this.orgId, page)
        .subscribe((data) => {
          this.loading = false;
          this.updateDeviceTable(
            data.devices,
            data.totalCount,
            data.totalPages,
          );
        });
    } else {
      this.ungroupedDevicesForOrg();
    }
  }
  updateDeviceTable(devices: any[], totalCount: number, totalPages: number) {
    if (this.selection.selected.length > 0) {
      this.selection.selected.forEach((ele) => {
        const selectedIndex = devices.findIndex(
          (row: any) => row.id === ele.id,
        );
        if (selectedIndex !== -1) {
          devices.splice(selectedIndex, 1);
          devices.push(ele);
        } else {
          devices.push(ele);
        }
      });
    }

    devices.forEach((ele: any) => {
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

    this.data = devices;
    this.dataSource = new MatTableDataSource(this.data);
    if (totalCount !== undefined) this.totalRows = totalCount;
    if (totalPages !== undefined) this.totalPages = totalPages;
    this.dataSource.sort = this.sort;
  }
  onSubmit(): void {
    if (this.selection.selected.length > 0) {
      const deviceId: any = [];
      this.selection.selected.forEach((ele) => {
        deviceId.push(ele.id);
      });
      this.reservationForm.controls['deviceIds'].setValue(deviceId);
      this.openpopupDialog();
    } else {
      this.toastrService.error(
        'Please select at least one device',
        'Validation Error!',
      );
    }
  }

  openpopupDialog() {
    this.dialogRef = this.dialog.open(this.popupDialog, {
      data: this.reservationbollean,
      height: '300px',
      width: '500px',
    });
    this.dialogRef.afterClosed().subscribe((result: any) => {
      this.onContinue(result);
    });
  }
  onContinue(result: any) {
    this.reservationForm.controls[
      'continueWithReservationIfOneOrMoreDevicesUnavailableForReservation'
    ].setValue(result.continewwithunavilableonedevice);
    this.reservationForm.controls[
      'continueWithReservationIfTargetCapacityIsLessThanDeviceTotalCapacityBetweenDuration'
    ].setValue(result.continueWithTCLessDTC);
    if (this.loginuser?.role === 'ApiUser') {
      if (this.selectionType === SelectionType.Checkbox) {
        this.reservationForm.value['type'] = GroupType.Multiple;
        this.reservationService
          .AddReservation(this.reservationForm.value, this.orgId)
          .subscribe({
            next: () => {
              this.reservationForm.reset();
              this.selection.clear();
              this.FilterForm.reset();
              //  this.getDeviceListData();
              this.toastrService.success(
                'Successfully!!',
                'Device Group Added',
              );
              this.dialogRef.close();
              this.router.navigate(['/device-groups']);
            },
            error: (err) => {
              //Error callback
              console.error('error caught in component', err);
              this.toastrService.error('error!', err.error.message);
            },
          });
      } else {
        this.reservationForm.value['type'] = GroupType.Single;
        this.reservationService
          .addSingleDevicePathway(this.reservationForm.value, this.orgId)
          .subscribe({
            next: () => {
              this.reservationForm.reset();
              this.selection.clear();
              this.FilterForm.reset();
              this.toastrService.success(
                'Successfully!!',
                'Device Pathway Added',
              );
              this.dialogRef.close();
              this.router.navigate(['/device-groups']);
            },
            error: (err) => {
              console.error('error caught in component', err);
              this.toastrService.error('error!', err.error.message);
            },
          });
      }
    } else {
      if (this.selectionType === SelectionType.Checkbox) {
        this.reservationForm.value['type'] = GroupType.Multiple;
        this.reservationService
          .AddReservation(this.reservationForm.value)
          .subscribe({
            next: () => {
              this.reservationForm.reset();
              this.selection.clear();
              this.FilterForm.reset();
              this.toastrService.success(
                'Successfully!!',
                'Device Group Added',
              );
              this.dialogRef.close();
              this.router.navigate(['/device-groups']);
            },
            error: (err) => {
              console.error('error caught in component', err);
              this.toastrService.error('error!', err.error.message);
            },
          });
      } else {
        this.reservationForm.value['type'] = GroupType.Single;
        this.reservationService
          .addSingleDevicePathway(this.reservationForm.value)
          .subscribe({
            next: () => {
              this.reservationForm.reset();
              this.selection.clear();
              this.FilterForm.reset();
              this.toastrService.success(
                'Successfully!!',
                'Device Pathway Added',
              );
              this.dialogRef.close();
              this.router.navigate(['/device-groups']);
            },
            error: (err) => {
              console.error('error caught in component', err);
              this.toastrService.error('error!', err.error.message);
            },
          });
      }
    }
  }

  // pageChangeEvent(event: PageEvent) {
  //   this.p = event.pageIndex + 1;
  //   this.displayList();
  // }

  previousPage(): void {
    if (this.p > 1) {
      this.p--;
      this.displayList(this.p);
    }
  }

  nextPage(): void {
    if (this.p < this.totalPages) {
      this.p++;
      this.displayList(this.p);
    }
  }
  alertDialog(deviceId: number): void {
    this.dialog.open(DeviceDetailsComponent, {
      data: {
        deviceid: deviceId,
      },
      width: '900px',
      height: '70vh',
    });
  }
}
