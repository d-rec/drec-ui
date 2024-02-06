import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllApiuserComponent } from './all-apiuser.component';

describe('AllApiuserComponent', () => {
  let component: AllApiuserComponent;
  let fixture: ComponentFixture<AllApiuserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AllApiuserComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AllApiuserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
