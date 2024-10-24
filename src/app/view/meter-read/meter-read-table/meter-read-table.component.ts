import { Component, ViewChild, OnInit, Input, Inject } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MeterReadService, DeviceService } from '../../../auth/services';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
  MatBottomSheetRef,
  MAT_BOTTOM_SHEET_DATA,
} from '@angular/material/bottom-sheet';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-meter-read-table',
  templateUrl: './meter-read-table.component.html',
  styleUrls: ['./meter-read-table.component.scss'],
})
export class MeterReadTableComponent implements OnInit {
  @ViewChild(MatPaginator)
  paginator!: MatPaginator;

  displayedColumns: string[] = ['startdate', 'enddate', 'value', 'ReadType']; //... set columns here

  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  readdata: any;

  devicedata: any;
  p: number = 1;
  total: number = 0;
  exterenalId: any;
  FilterForm: FormGroup;
  endminDate = new Date();
  showfilterform: boolean = true;
  totalRows = 0;
  pageSize = 5;
  currentPage = 0;
  pageSizeOptions: number[] = [5];
  loading: boolean = true;
  loginuser: any;
  device_timezone: any;
  filter: boolean;
  @Input()
  showtable: boolean;
  showname: boolean = false;

  constructor(
    private service: MeterReadService,
    private formBuilder: FormBuilder,
    private toastrService: ToastrService,
    private deviceservice: DeviceService,
    private bottomSheetRef: MatBottomSheetRef<MeterReadTableComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any,
  ) {}
  ngOnInit() {
    if (this.data != null) {
      this.showname = true;
      this.FilterForm = this.formBuilder.group({
        exterenalId: [this.data.rexternalid, Validators.required],
        start: [this.data.reservationStartDate, Validators.required],
        end: [this.data.reservationEndDate, Validators.required],
        pagenumber: [this.p],
      });
      this.exterenalId = this.data.rexternalid;

      if (this.exterenalId != undefined) {
        this.getPagedData();
      }
    }
  }

  start(FilterForm: any, exterenalId: any, filter: boolean) {
    this.exterenalId = exterenalId;

    this.FilterForm = FilterForm;
    this.filter = filter;
    if (filter) {
      this.getPagedData();
    }
  }

  getPagedData() {
    this.FilterForm.controls['pagenumber'].setValue(this.p);

    this.service.GetRead(this.exterenalId, this.FilterForm.value).subscribe(
      (response: any) => {
        this.filter = true;
        this.readdata = response;
        this.readdata.historyread.forEach((element: any) => {
          element['readtype'] = 'History';
          element['color'] = '#008000';
        });
        this.readdata.ongoing.forEach((element: any) => {
          element['readtype'] = 'Ongoing';
          element['color'] = '#f2be1a';
        });
        this.dataSource = new MatTableDataSource([
          ...this.readdata.historyread,
          ...this.readdata.ongoing,
        ]);
        this.totalRows = this.readdata.numberOfReads;

        this.currentPage = this.readdata.currentPageNumber;
        this.device_timezone = this.readdata.timezone;
        this.loading = false;
      },
      (error) => {
        //Error callback
        console.error('error caught in component', error);
        // this.dataSource=new MatTableDataSource([]);
        this.filter = false;
        this.toastrService.error('error', error.error.message);
      },
    );
  }

  pageChangeEvent(event: PageEvent) {
    this.p = event.pageIndex + 1;

    this.getPagedData();
  }
  openLink(event: MouseEvent): void {
    this.bottomSheetRef.dismiss();
    event.preventDefault();
  }
}
