import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
import { MeterReadService, DeviceService, AdminService } from '../../../auth/services';
import { AuthbaseService } from '../../../auth/authbase.service'
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import * as moment from 'moment';
import * as momentTimeZone from 'moment-timezone';
import { getValidmsgTimezoneFormat } from '../../../utils/getTimezone_msg'
@Component({
  selector: 'app-addread',
  templateUrl: './addread.component.html',
  styleUrls: ['./addread.component.scss']
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
  showerrorexternalid: boolean;
  timezonedata: any = [];
  countrylist: any;
  hidestarttime: boolean = true;
  readtype = ['History', 'Delta', 'Aggregate'];
  unit = ['Wh', 'kWh', 'MWh', 'GWh'];
  commissioningDate: any;
  selectedResult: any;
  filteredOptions: Observable<any[]>;
  orgId: number;
  orglist: any;
  loginuser: any;
  constructor(private fb: FormBuilder, private readService: MeterReadService,
    private deviceservice: DeviceService,
    private authService: AuthbaseService,
    private router: Router, private toastrService: ToastrService,
    private adminService: AdminService) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }


  ngOnInit() {

    if (this.loginuser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe(
        (data) => {
          this.orglist = data;
        })
    }
    this.readForm = this.fb.group({
      timezone: new FormControl(),
      externalId: [null, Validators.required],
      type: [null, Validators.required],
      unit: [null, Validators.required],

      reads: this.fb.array([
      ])
    })
    const read = this.fb.group({
      starttimestamp: [''],
      endtimestamp: [null, Validators.required],
      value: [null, Validators.required],
    }, {
      validators: (control) => {

        if (control.value.starttimestamp > control.value.endtimestamp) {
          console.log('49');
          //@ts-ignore
          control.get("endtimestamp").setErrors({ notSame: true });
        }
        return null;
      },
    })
    this.addreads.push(read);
    // this.DisplayList();
    //this.TimeZoneList();
    this.authService.GetMethod('countrycode/list').subscribe(
      (data3) => {
        this.countrylist = data3;
      }
    );

  }


  get addreads() {
    return this.readForm.controls["reads"] as FormArray;
  }
  search(): void {
    const input = this.readForm.controls['externalId'].value;
    console.log(input)
    if (input && input != '') {
      if (this.loginuser.role === 'Admin') {
        this.adminService.GetDeviceAutocomplete(input, this.orgId).subscribe(
          (response) => {
            this.autocompleteResults = response;
          },
          (error) => {
            console.error('Error fetching autocomplete results:', error);
          }
        );
      } else {
        this.deviceservice.GetDeviceAutocomplete(input,).subscribe(
          (response) => {
            this.autocompleteResults = response;
          },
          (error) => {
            console.error('Error fetching autocomplete results:', error);
          }
        );
      }
    } else {
      this.autocompleteResults = [];
      this.timezonedata = [];
      this.readForm.controls['externalId'].setValue(null);
      this.readForm.controls['timezone'].setValue(null);
      this.filteredOptions = this.readForm.controls['timezone'].valueChanges.pipe(
        startWith(''),
        map(value => this._filter(value || '')),
      );
    }
  }
  // displayFn(result: any): string {
  //   return result ? result.label : '';
  // }
  lastreadvalue: number;
  lastreaddate: any;
  onSelect(result: any): void {
    this.selectedResult = result;
    console.log(this.selectedResult);
    console.log(result);
    this.readForm.controls['externalId'].setValue(result.externalId);
    this.devicecreateddate = result.createdAt;
    this.commissioningDate = result.commissioningDate;

    this.historyAge = new Date(this.devicecreateddate);
    this.historyAge.setFullYear(this.historyAge.getFullYear() - 3);
    //@ts-ignore
    this.timezonedata = this.countrylist.find(countrycode => countrycode.alpha3 == result.countryCode)?.timezones;
    console.log(this.timezonedata);
    this.readForm.controls['timezone'].setValue(null);
    this.filteredOptions = this.readForm.controls['timezone'].valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value || '')),
    );
    console.log(this.filteredOptions);
    this.addreads.reset();
    this.readForm.controls['type'].setValue(null)
    let deivceid;
    if (this.loginuser.role==='Admin'){
      deivceid=result.id;
    }else{
      deivceid=result.exterenalId;
    }
    this.readService.Getlastread(deivceid).subscribe({
      next: data => {
        console.log(data),
          this.lastreaddate = data.enddate;
        this.lastreadvalue = data.value;
      },
      error: err => {                      //Error callback
        console.error('error caught in component', err)
      }
    })
    this.endmaxdate = new Date();
  }
  onTimezoneSelect(timezone: any): void {
    console.log(timezone);
    console.log(momentTimeZone
      .tz(new Date(this.devicecreateddate), timezone)
      .format('YYYY-MM-DDTHH:mm:ssZ'));

    this.devicecreateddate = momentTimeZone
      .tz(new Date(this.devicecreateddate), timezone)
      .format('YYYY-MM-DDTHH:mm:ss');
    console.log(this.devicecreateddate);
    this.commissioningDate = momentTimeZone
      .tz(new Date(this.commissioningDate), timezone)
      .format('YYYY-MM-DDTHH:mm:ss');
    console.log(this.commissioningDate);
    //momentTimeZone.tz(this.devicecreateddate, timezone);
    this.endmaxdate = new Date(momentTimeZone
      .tz(new Date(), timezone)
      .format('YYYY-MM-DDTHH:mm:ss'));
    console.log(this.endmaxdate)
  }
  private _filter(value: string): string[] {
    //  console.log(this.timezonedata)
    const filterValue = value.toLowerCase();
    //  console.log(filterValue)
    // console.log(this.timezonedata.filter((option: any) => option.name.toLowerCase().includes(filterValue)));
    if ((!(this.timezonedata.filter((option: any) => option.name.toLowerCase().includes(filterValue)).length > 0) && filterValue != '')) {
      this.showerror = true;
    } else {
      this.showerror = false;
    }
    this.endmaxdate = new Date();
    return this.timezonedata.filter((option: any) => option.name.toLowerCase().includes(filterValue))
  }
  DisplayList() {
    const deviceurl = 'device/my';
    console.log(deviceurl);
    this.deviceservice.GetMyDevices(deviceurl).subscribe(
      (data) => {
        console.log("data", data)
        // display list in the console 
        this.data = data;
      }
    )
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
  //   console.log(event);
  //   this.addreads.reset();
  //   this.readForm.controls['type'].setValue(null)
  //   this.devicecreateddate = event.createdAt;
  //   this.commissioningDate = event.commissioningDate;

  //   this.historyAge = new Date(this.devicecreateddate);
  //   this.historyAge.setFullYear(this.historyAge.getFullYear() - 3);
  //   //@ts-ignore
  //   this.timezonedata = this.countrylist.find(countrycode => countrycode.alpha3 == event.countryCode)?.timezones;
  //   console.log(this.timezonedata);
  //   this.readForm.controls['timezone'].setValue(null);
  //   this.filteredOptions = this.readForm.controls['timezone'].valueChanges.pipe(
  //     startWith(''),
  //     map(value => this._filter(value || '')),
  //   );
  //   console.log(this.filteredOptions);
  //   this.readService.Getlastread(event.externalId).subscribe({
  //     next: data => {
  //       console.log(data),
  //         this.lastreaddate = data.enddate;
  //       this.lastreadvalue = data.value;
  //     },
  //     error: err => {                      //Error callback
  //       console.error('error caught in component', err)
  //     }
  //   })

  // }
  onChangeEvent(event: any) {
    console.log(event);
    console.log(new Date(this.devicecreateddate));
    if (event === 'Delta' || event === 'Aggregate') {
      this.endminDate = this.devicecreateddate;
      console.log(this.endminDate);
      this.hidestarttime = false;
    } else {
      if (new Date(this.commissioningDate).getTime() > new Date(this.historyAge).getTime()) {
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
    console.log(event);
    this.endmaxdate = this.devicecreateddate;
    this.endminDate = event;
  }

  getErrorcheckdatavalidation() {
    return this.readForm.controls["reads"].get('endtimestamp')?.hasError('required') ? 'This field is required' :
      this.readForm.controls["reads"].get('endtimestamp')?.hasError('notSame') ? ' Please add a valid endtimestamp' : '';
  }
  checkValidation(input: string) {
    const validation = this.readForm.controls["reads"].get(input)?.invalid && (this.readForm.controls["reads"].get(input)?.dirty || this.readForm.controls["reads"].get(input)?.touched)
    return validation;
  }
  onSubmit(): void {

    let externalId = this.readForm.value.externalId;
    console.log(externalId);
    console.log(this.readForm.value);

    const myobj: any = {}
    if ((this.readForm.value.timezone != null && this.readForm.value.timezone != '') && this.readForm.value.type === 'History') {
      myobj['timezone'] = this.readForm.value.timezone
      myobj['type'] = this.readForm.value.type
      myobj['unit'] = this.readForm.value.unit
      let reads: any = []
      this.readForm.value.reads.forEach((ele: any) => {
        reads.push({
          starttimestamp: moment(ele.starttimestamp).format('YYYY-MM-DD HH:mm:ss'),
          endtimestamp: moment(ele.endtimestamp).format('YYYY-MM-DD HH:mm:ss'),
          value: ele.value,
        })
      })
      myobj['reads'] = reads
    } else if ((this.readForm.value.timezone != null && this.readForm.value.timezone != '') && this.readForm.value.type != 'History') {

      myobj['timezone'] = this.readForm.value.timezone
      myobj['type'] = this.readForm.value.type
      myobj['unit'] = this.readForm.value.unit
      let newreads: any = []
      this.readForm.value.reads.forEach((ele: any) => {
        newreads.push({
          starttimestamp: "",
          endtimestamp: moment(ele.endtimestamp).format('YYYY-MM-DD HH:mm:ss'),
          value: ele.value,
        })
      })
      myobj['reads'] = newreads
    } else {
      myobj['type'] = this.readForm.value.type
      myobj['unit'] = this.readForm.value.unit
      let newreads: any = []
      this.readForm.value.reads.forEach((ele: any) => {
        newreads.push({
          starttimestamp: ele.starttimestamp,
          endtimestamp: ele.endtimestamp,
          value: ele.value,
        })
      })
      myobj['reads'] = newreads
    }
   
    this.readService.PostRead(externalId, myobj,this.orgId).subscribe({
      next: (data: any) => {
        console.log(data)
        this.readForm.reset();
        this.selectedResult = null;
        const formControls = this.readForm.controls;
        Object.keys(formControls).forEach(key => {
          const control = formControls[key];
          control.setErrors(null);
        });
        this.toastrService.success('Successfully!', 'Read Added!!');
      },
      error: (err: { error: { message: string | undefined; }; }) => {                          //Error callback
        console.error('error caught in component', err)
        //@ts-ignore
        let message = getValidmsgTimezoneFormat(err.error.message);
        console.error(message)

        this.toastrService.error(message, 'error!');
      }
    });
  }

}
