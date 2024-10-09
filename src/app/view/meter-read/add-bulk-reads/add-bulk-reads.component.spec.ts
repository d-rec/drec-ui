import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddBulkReadsComponent } from './add-bulk-reads.component';

describe('AddBulkReadsComponent', () => {
  let component: AddBulkReadsComponent;
  let fixture: ComponentFixture<AddBulkReadsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddBulkReadsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddBulkReadsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
