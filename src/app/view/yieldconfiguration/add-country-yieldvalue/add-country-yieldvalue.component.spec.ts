import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddCountryYieldvalueComponent } from './add-country-yieldvalue.component';

describe('AddCountryYieldvalueComponent', () => {
  let component: AddCountryYieldvalueComponent;
  let fixture: ComponentFixture<AddCountryYieldvalueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddCountryYieldvalueComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddCountryYieldvalueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
