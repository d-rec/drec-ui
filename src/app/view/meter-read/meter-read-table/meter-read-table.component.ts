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
import { DatePipe } from '@angular/common';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-meter-read-table',
  templateUrl: './meter-read-table.component.html',
  styleUrls: ['./meter-read-table.component.scss'],
  providers: [DatePipe],
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
  private pdfMakeLoaded = false;
  constructor(
    private service: MeterReadService,
    private formBuilder: FormBuilder,
    private toastrService: ToastrService,
    private deviceservice: DeviceService,
    private bottomSheetRef: MatBottomSheetRef<MeterReadTableComponent>,
    private datePipe: DatePipe,
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

  getFormattedDate(): string {
    return this.datePipe.transform(new Date(), 'yyyy-MM-dd') || '';
  }

  exportToCSV() {
    if (
      !this.dataSource ||
      !this.dataSource.data ||
      this.dataSource.data.length === 0
    ) {
      this.toastrService.warning('No data available to export');
      return;
    }

    // Create header row
    const headers = [
      'Start Datetime',
      'End Datetime',
      'Value(Wh)',
      'Read Type',
    ];

    // Convert data to CSV format
    const rows = this.dataSource.data.map((item) => {
      const startDate = this.formatDateForExport(item.startdate);
      const endDate = this.formatDateForExport(item.enddate);
      return `"${startDate}","${endDate}","${item.value}","${item.readtype}"`;
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create file and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `meter_reads_${this.getFormattedDate()}.csv`;
    saveAs(blob, fileName);
  }

  async exportToPDF() {
    if (
      !this.dataSource ||
      !this.dataSource.data ||
      this.dataSource.data.length === 0
    ) {
      this.toastrService.warning('No data available to export');
      return;
    }

    try {
      if (!this.pdfMakeLoaded) {
        const pdfMakeModule = await import('pdfmake/build/pdfmake');
        const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
        (pdfMakeModule.default as any).vfs = pdfFontsModule.default.vfs;
        this.pdfMakeLoaded = true;
        this.loading = false;
      }
      // Data for PDF
      const tableData = this.dataSource.data.map((item) => {
        const startDate = this.formatDateForExport(item.startdate);
        const endDate = this.formatDateForExport(item.enddate);
        return [startDate, endDate, item.value.toString(), item.readtype];
      });

      // Insert header row
      tableData.unshift([
        'Start Datetime',
        'End Datetime',
        'Value(Wh)',
        'Read Type',
      ]);

      const headerName = 'Meter Readings';

      const pdfMake = (await import('pdfmake/build/pdfmake')).default;

      // document structure
      const documentDefinition: TDocumentDefinitions = {
        content: [
          { text: headerName, style: 'header' },
          {
            text: `Export Date: ${this.datePipe.transform(new Date(), 'MMMM d, yyyy')}`,
            style: 'subheader',
          },
          {
            style: 'tableExample',
            table: {
              headerRows: 1,
              widths: ['*', '*', 'auto', 'auto'],
              body: tableData,
            },
            layout: {
              fillColor: (rowIndex: number) => {
                return rowIndex === 0 ? '#f2f2f2' : null;
              },
            },
          },
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
            margin: [0, 0, 0, 10],
            color: '#f2be1a',
          },
          subheader: {
            fontSize: 14,
            bold: true,
            margin: [0, 10, 0, 5],
          },
          tableExample: {
            margin: [0, 5, 0, 15],
          },
        },
        defaultStyle: {
          fontSize: 10,
        },
      };
      pdfMake
        .createPdf(documentDefinition)
        .download(`meter_reads_${this.getFormattedDate()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.toastrService.error('Failed to generate PDF');
    }
  }

  private formatDateForExport(dateString: string): string {
    try {
      if (!dateString) return '';

      return (
        this.datePipe.transform(
          dateString,
          'MMM d, y, h:mm:ss a',
          this.device_timezone,
        ) || dateString
      );
    } catch (error) {
      return dateString;
    }
  }
}
