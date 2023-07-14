import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllCountryYieldvalueComponent } from './all-country-yieldvalue.component';

describe('AllCountryYieldvalueComponent', () => {
  let component: AllCountryYieldvalueComponent;
  let fixture: ComponentFixture<AllCountryYieldvalueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AllCountryYieldvalueComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AllCountryYieldvalueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
