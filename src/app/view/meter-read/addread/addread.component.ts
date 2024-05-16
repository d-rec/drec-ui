import { Component, OnInit } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  FormArray,
  Validators,
  FormControl,
} from '@angular/forms';
import {
  MeterReadService,
  DeviceService,
  AdminService,
  OrganizationService,
} from '../../../auth/services';
import { AuthbaseService } from '../../../auth/authbase.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import * as moment from 'moment';
import * as momentTimeZone from 'moment-timezone';
import { getValidmsgTimezoneFormat } from '../../../utils/getTimezone_msg';
@Component({
  selector: 'app-addread',
  templateUrl: './addread.component.html',
  styleUrls: ['./addread.component.scss'],
})
export class AddreadComponent implements OnInit {
  autocompleteResults: any[] = [];
  // searchControl: FormControl = new FormControl();
  filteredResults: Observable<any[]>;
  startmaxDate = new Date();
  startminDate = new Date();
  endminDate = new Date();
  endmaxdate = new Date();
  historyAge: any;
  devicecreateddate: any;
  readForm: FormGroup;
  public stepHour = 1;
  public stepMinute = 1;
  public stepSecond = 1;
  data: any;
  showerror: boolean;
  showerrorexternalid: boolean = false;
  timezonedata: any = [];
  countrylist: any;
  hidestarttime: boolean = true;
  readtype = ['History', 'Delta', 'Aggregate'];
  unit = ['Wh', 'kWh', 'MWh', 'GWh'];
  commissioningDate: any;
  selectedResult: any;
  filteredOptions: Observable<any[]>;
  filteredexternalIdOptions: Observable<any[]>;
  orglist: any;
  loginuser: any;
  filteredOrgList: any[] = [];
  //public color: ThemePalette = 'primary';
  orgname: string;
  orgId: number;
  devicelist: any = [];
  showmeter_readformadmin: boolean;
  showexternaiIdform: boolean = false;
  constructor(
    private fb: FormBuilder,
    private readService: MeterReadService,
    private deviceservice: DeviceService,
    private authService: AuthbaseService,
    private router: Router,
    private toastrService: ToastrService,
    private adminService: AdminService,
    private orgService: OrganizationService,
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);

    if (this.loginuser.role === 'Admin' || this.loginuser.role === 'ApiUser') {
      this.showmeter_readformadmin = true;
    } else {
      this.showmeter_readformadmin = false;
    }
  }

  ngOnInit() {
    if (this.loginuser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe((data) => {
        //@ts-ignore
        this.orglist = data.organizations.filter(
          (org) => org.organizationType != 'Buyer',
        );
        this.filteredOrgList = this.orglist;
      });
    } else if (this.loginuser.role === 'ApiUser') {
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        //@ts-ignore
        this.orglist = data.organizations.filter(
          (org) => org.organizationType != 'Buyer',
        );

        // const buyerOrganizations = data.filter(org => org.organizationType === "Buyer");
        this.filteredOrgList = this.orglist;
        // Once data is loaded, call any other functions that depend on it

        // this.date = new Date();
      });
    } else {
      this.gedevicefororg();
    }
    this.readForm = this.fb.group({
      timezone: new FormControl(),
      externalId: [null, Validators.required],
      type: [null, Validators.required],
      unit: [null, Validators.required],
      reads: this.fb.array([]),
    });
    const read = this.fb.group(
      {
        starttimestamp: [''],
        endtimestamp: [null, Validators.required],
        value: [null, Validators.required],
      },
      {
        validators: (control) => {
          if (control.value.starttimestamp > control.value.endtimestamp) {
            //@ts-ignore
            control.get('endtimestamp').setErrors({ notSame: true });
          }
          return null;
        },
      },
    );
    this.addreads.push(read);
    // this.DisplayList();
    //this.TimeZoneList();
    this.authService.GetMethod('countrycode/list').subscribe((data3) => {
      this.countrylist = data3;
    });
    setTimeout(() => {
      if (this.loginuser.role != 'Admin') {
        this.readForm.controls['externalId'];
        this.filteredexternalIdOptions = this.readForm.controls[
          'externalId'
        ].valueChanges.pipe(
          startWith(''),
          map((value) => this._externalIdfilter(value || '')),
        );
      }
      //  this.getDeviceinfo();
    }, 2000);
  }

  get addreads() {
    return this.readForm.controls['reads'] as FormArray;
  }
  filterOrgList() {
    this.filteredOrgList = this.orglist.filter((org: any) => {
      return org.name.toLowerCase().includes(this.orgname.toLowerCase());
    });
  }
  selectOrg(event: any) {
    this.showexternaiIdform = true;
    //@ts-ignore
    const selectedCountry = this.orglist.find(
      (option) => option.name === event.option.value,
    );
    if (selectedCountry) {
      this.orgId = selectedCountry.id;
      if (this.loginuser.role === 'ApiUser') {
        this.gedevicefororg();
      } else {
        this.gedeviceforadmin(this.orgId);
      }
    }
  }

  gedeviceforadmin(orgid: number) {
    const deviceurl = 'device?OrganizationId=' + orgid;
    this.deviceservice.GetMyDevices(deviceurl).subscribe({
      next: (data) => {
        this.devicelist = data.devices;
        this.readForm.controls['externalId'];
        this.filteredexternalIdOptions = this.readForm.controls[
          'externalId'
        ].valueChanges.pipe(
          startWith(''),
          map((value) => this._externalIdfilterbyAdmin(value || '')),
        );
      },
    });
  }

  gedevicefororg() {
    if (this.loginuser.role === 'ApiUser') {
      const deviceurl = 'device/my?';
      const FilterForm = { organizationId: this.orgId };
      this.deviceservice.GetMyDevices(deviceurl, FilterForm).subscribe({
        next: (data) => {
          this.devicelist = data.devices;
          this.readForm.controls['externalId'];
          this.filteredexternalIdOptions = this.readForm.controls[
            'externalId'
          ].valueChanges.pipe(
            startWith(''),
            map((value) => this._externalIdfilter(value || '')),
          );
        },
      });
    } else {
      const deviceurl = 'device/my';
      this.deviceservice.GetMyDevices(deviceurl).subscribe({
        next: (data) => {
          this.devicelist = data;
        },
      });
    }
  }

  _externalIdfilter(value: string): string[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.devicelist.filter((option: any) =>
          option.externalId.toLowerCase().includes(filterValue),
        ).length > 0
      ) &&
      filterValue != ''
    ) {
      this.showerror = true;
      this.showerrorexternalid = true;
    } else {
      this.showerror = false;
      this.showerrorexternalid = false;
    }
    //  this.endmaxdate = new Date();
    return this.devicelist.filter((option: any) =>
      option.externalId.toLowerCase().includes(filterValue),
    );
  }

  _externalIdfilterbyAdmin(value: string): string[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.devicelist.filter((option: any) =>
          option.developerExternalId.toLowerCase().includes(filterValue),
        ).length > 0
      ) &&
      filterValue != ''
    ) {
      this.showerror = true;
      this.showerrorexternalid = true;
    } else {
      this.showerror = false;
      this.showerrorexternalid = false;
    }
    //  this.endmaxdate = new Date();
    return this.devicelist.filter((option: any) =>
      option.developerExternalId.toLowerCase().includes(filterValue),
    );
  }
  search() {
    // const input = this.readForm.controls['externalId'].value;
    //if (input && input != '') {
    if (this.loginuser.role === 'Admin') {
      const deviceurl = 'device?';
      //this.adminService.GetDeviceAutocomplete(input, this.orgId).subscribe(
      this.deviceservice
        .GetMyDevices(deviceurl, { organizationId: this.orgId })
        .subscribe(
          (response) => {
            this.autocompleteResults = response;
            this.showerrorexternalid = false;
          },
          (error) => {
            console.error('Error fetching autocomplete results:', error);
          },
        );
    } else {
      const deviceurl = 'device/my?';
      this.deviceservice.GetMyDevices(deviceurl).subscribe(
        (response) => {
          this.autocompleteResults = response;
          this.showerrorexternalid = false;
        },
        (error) => {
          console.error('Error fetching autocomplete results:', error);
        },
      );
    }
    // } else {
    //   this.autocompleteResults = [];
    //  this.showerrorexternalid=true;
    //   this.timezonedata = [];
    //   this.readForm.controls['externalId'].setValue(null);
    //   this.readForm.controls['timezone'].setValue(null);
    //   this.filteredOptions = this.readForm.controls['timezone'].valueChanges.pipe(
    //     startWith(''),
    //     map(value => this._filter(value || '')),
    //   );
    // }
  }
  // displayFn(result: any): string {
  //   return result ? result.label : '';
  // }
  lastreadvalue: number;
  lastreaddate: any;
  onSelect(result: any): void {
    this.selectedResult = result;
    this.devicecreateddate = result.createdAt;
    this.commissioningDate = result.commissioningDate;

    this.historyAge = new Date(this.devicecreateddate);
    this.historyAge.setFullYear(this.historyAge.getFullYear() - 3);
    //@ts-ignore
    this.timezonedata = this.countrylist.find(
      (countrycode) => countrycode.alpha3 == result.countryCode,
    )?.timezones;

    this.readForm.controls['timezone'].setValue(null);
    this.filteredOptions = this.readForm.controls['timezone'].valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '')),
    );
    this.addreads.reset();
    this.readForm.controls['type'].setValue(null);
    let deivceid;
    if (this.loginuser.role === 'Admin') {
      this.readForm.controls['externalId'].setValue(result.developerExternalId);
      deivceid = result.id;
    } else if (this.loginuser.role === 'ApiUser') {
      this.readForm.controls['externalId'].setValue(result.externalId);
      deivceid = result.id;
    } else {
      this.readForm.controls['externalId'].setValue(result.externalId);
      deivceid = result.externalId;
    }
    this.readService.Getlastread(deivceid).subscribe({
      next: (data) => {
        this.lastreaddate = data.enddate;
        this.lastreadvalue = data.value;
      },
      error: (err) => {
        //Error callback
        console.error('error caught in component', err);
      },
    });
    this.endmaxdate = new Date();
  }
  onTimezoneSelect(timezone: any): void {
    this.historyAge = momentTimeZone
      .tz(new Date(this.historyAge), timezone)
      .format('YYYY-MM-DDTHH:mm:ss');
    this.devicecreateddate = momentTimeZone
      .tz(new Date(this.devicecreateddate), timezone)
      .format('YYYY-MM-DDTHH:mm:ss');

    this.commissioningDate = momentTimeZone
      .tz(new Date(this.commissioningDate), timezone)
      .format('YYYY-MM-DDTHH:mm:ss');

    //momentTimeZone.tz(this.devicecreateddate, timezone);
    this.endmaxdate = new Date(
      momentTimeZone.tz(new Date(), timezone).format('YYYY-MM-DDTHH:mm:ss'),
    );
  }
  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.timezonedata.filter((option: any) =>
          option.name.toLowerCase().includes(filterValue),
        ).length > 0
      ) &&
      filterValue != ''
    ) {
      this.showerror = true;
    } else {
      this.showerror = false;
    }
    this.endmaxdate = new Date();
    return this.timezonedata.filter((option: any) =>
      option.name.toLowerCase().includes(filterValue),
    );
  }
  DisplayList() {
    const deviceurl = 'device/my';
    this.deviceservice.GetMyDevices(deviceurl).subscribe((data) => {
      this.data = data;
    });
  }
  // TimeZoneList() {
  //   this.authService.GetMethod('meter-reads/time-zones').subscribe(
  //     (data) => {
  //       // display list in the console
  //       this.timezonedata = data;
  //     }
  //   )
  // }

  // ExternaIdonChangeEvent(event: any) {
  //   this.addreads.reset();
  //   this.readForm.controls['type'].setValue(null)
  //   this.devicecreateddate = event.createdAt;
  //   this.commissioningDate = event.commissioningDate;

  //   this.historyAge = new Date(this.devicecreateddate);
  //   this.historyAge.setFullYear(this.historyAge.getFullYear() - 3);
  //   //@ts-ignore
  //   this.timezonedata = this.countrylist.find(countrycode => countrycode.alpha3 == event.countryCode)?.timezones;

  //   this.readForm.controls['timezone'].setValue(null);
  //   this.filteredOptions = this.readForm.controls['timezone'].valueChanges.pipe(
  //     startWith(''),
  //     map(value => this._filter(value || '')),
  //   );

  //   this.readService.Getlastread(event.externalId).subscribe({
  //     next: data => {

  //         this.lastreaddate = data.enddate;
  //       this.lastreadvalue = data.value;
  //     },
  //     error: err => {                      //Error callback
  //       console.error('error caught in component', err)
  //     }
  //   })

  // }
  onChangeEvent(event: any) {
    if (event === 'Delta' || event === 'Aggregate') {
      this.endmaxdate = new Date();
      this.endminDate = this.devicecreateddate;
      if (this.readForm.value.timezone != null) {
        this.endmaxdate = new Date(
          momentTimeZone
            .tz(new Date(), this.readForm.value.timezone)
            .format('YYYY-MM-DDTHH:mm:ss'),
        );
      }
      this.hidestarttime = false;
    } else {
      if (
        new Date(this.commissioningDate).getTime() >
        new Date(this.historyAge).getTime()
      ) {
        this.startminDate = this.commissioningDate;
        this.endminDate = this.commissioningDate;
      } else {
        this.startminDate = this.historyAge;
        this.endminDate = this.historyAge;
      }

      this.startmaxDate = this.devicecreateddate;
      this.endmaxdate = this.devicecreateddate;

      this.hidestarttime = true;
    }
  }
  onEndChangeEvent(event: any) {
    this.endmaxdate = this.devicecreateddate;
    this.endminDate = event;
  }

  getErrorcheckdatavalidation() {
    return this.readForm.controls['reads']
      .get('endtimestamp')
      ?.hasError('required')
      ? 'This field is required'
      : this.readForm.controls['reads'].get('endtimestamp')?.hasError('notSame')
        ? ' Please add a valid endtimestamp'
        : '';
  }
  checkValidation(input: string) {
    const validation =
      this.readForm.controls['reads'].get(input)?.invalid &&
      (this.readForm.controls['reads'].get(input)?.dirty ||
        this.readForm.controls['reads'].get(input)?.touched);
    return validation;
  }
  onSubmit(): void {
    let externalId = this.readForm.value.externalId;

    const myobj: any = {};
    if (this.loginuser.role === 'ApiUser') {
      myobj['organizationId'] = this.orgId;
    }
    if (
      this.readForm.value.timezone != null &&
      this.readForm.value.timezone != '' &&
      this.readForm.value.type === 'History'
    ) {
      myobj['timezone'] = this.readForm.value.timezone;
      myobj['type'] = this.readForm.value.type;
      myobj['unit'] = this.readForm.value.unit;
      let reads: any = [];
      this.readForm.value.reads.forEach((ele: any) => {
        reads.push({
          starttimestamp: moment(ele.starttimestamp).format(
            'YYYY-MM-DD HH:mm:ss',
          ),
          endtimestamp: moment(ele.endtimestamp).format('YYYY-MM-DD HH:mm:ss'),
          value: ele.value,
        });
      });
      myobj['reads'] = reads;
    } else if (
      this.readForm.value.timezone != null &&
      this.readForm.value.timezone != '' &&
      this.readForm.value.type != 'History'
    ) {
      myobj['timezone'] = this.readForm.value.timezone;
      myobj['type'] = this.readForm.value.type;
      myobj['unit'] = this.readForm.value.unit;
      let newreads: any = [];
      this.readForm.value.reads.forEach((ele: any) => {
        newreads.push({
          starttimestamp: '',
          endtimestamp: moment(ele.endtimestamp).format('YYYY-MM-DD HH:mm:ss'),
          value: ele.value,
        });
      });
      myobj['reads'] = newreads;
    } else {
      myobj['type'] = this.readForm.value.type;
      myobj['unit'] = this.readForm.value.unit;
      let newreads: any = [];
      this.readForm.value.reads.forEach((ele: any) => {
        newreads.push({
          starttimestamp: ele.starttimestamp,
          endtimestamp: ele.endtimestamp,
          value: ele.value,
        });
      });
      myobj['reads'] = newreads;
    }
    if (this.loginuser.role === 'Admin') {
      this.readService
        .PostReadByAdmin(externalId, myobj, this.orgId)
        .subscribe({
          next: (data: any) => {
            this.readForm.reset();
            this.selectedResult = null;
            const formControls = this.readForm.controls;
            Object.keys(formControls).forEach((key) => {
              const control = formControls[key];
              control.setErrors(null);
            });
            this.toastrService.success('Successfully!', 'Read Added!!');
          },
          error: (err: { error: { message: string | undefined } }) => {
            //Error callback
            console.error('error caught in component', err);
            //@ts-ignore
            let message = getValidmsgTimezoneFormat(err.error.message);

            this.toastrService.error(message, 'error!');
          },
        });
    } else {
      this.readService.PostRead(externalId, myobj).subscribe({
        next: (data: any) => {
          this.readForm.reset();
          this.selectedResult = null;
          const formControls = this.readForm.controls;
          Object.keys(formControls).forEach((key) => {
            const control = formControls[key];
            control.setErrors(null);
          });
          this.toastrService.success('Successfully!', 'Read Added!!');
        },
        error: (err: { error: { message: string | undefined } }) => {
          //Error callback
          console.error('error caught in component', err);
          //@ts-ignore
          let message = getValidmsgTimezoneFormat(err.error.message);

          this.toastrService.error(message, 'error!');
        },
      });
    }
  }
}
