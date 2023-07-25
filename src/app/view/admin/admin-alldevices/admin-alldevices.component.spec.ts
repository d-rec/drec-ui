import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAlldevicesComponent } from './admin-alldevices.component';

describe('AdminAlldevicesComponent', () => {
  let component: AdminAlldevicesComponent;
  let fixture: ComponentFixture<AdminAlldevicesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AdminAlldevicesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminAlldevicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
