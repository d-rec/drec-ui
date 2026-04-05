import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllRegistrantComponent } from './all-registrant.component';

describe('AllRegistrantComponent', () => {
  let component: AllRegistrantComponent;
  let fixture: ComponentFixture<AllRegistrantComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AllRegistrantComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AllRegistrantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
