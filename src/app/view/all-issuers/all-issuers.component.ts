import { Component, OnInit, ViewChild } from '@angular/core';
import { IssuerService } from '../../auth/services/issuer.service';
import { EvidentIssuer } from '../../models/evident';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

@Component({
  standalone: false,
  selector: 'app-all-issuers',
  templateUrl: './all-issuers.component.html',
})
export class AllIssuersComponent implements OnInit {
  issuers: EvidentIssuer[];
  dataSource: MatTableDataSource<EvidentIssuer>;
  displayedColumns = [
    'name',
    'issuerId',
    'email',
    'country',
    'address',
    'regions',
  ];
  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  totalPages: number = 1;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(private issuerService: IssuerService) {}

  ngOnInit(): void {
    this.getIssuers();
  }

  ngAfterViewInit() {
    if (this.dataSource) {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    }
  }

  getIssuers() {
    this.issuerService.getIssuers(this.currentPage, this.pageSize).subscribe({
      next: (res) => {
        this.issuers = res.data;
        this.totalItems = res.total;
        this.totalPages = Math.ceil(this.totalItems / this.pageSize);
        this.dataSource = new MatTableDataSource(this.issuers);
        this.dataSource.sort = this.sort;
      },
      error: (error) => {
        console.error('Error loading issuers:', error);
      },
    });
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.getIssuers();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.getIssuers();
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
    this.currentPage = 1;
  }
}
