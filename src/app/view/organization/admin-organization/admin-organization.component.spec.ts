import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminOrganizationComponent } from './admin-organization.component';

describe('AdminOrganizationComponent', () => {
  let component: AdminOrganizationComponent;
  let fixture: ComponentFixture<AdminOrganizationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AdminOrganizationComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminOrganizationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
