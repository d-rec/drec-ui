describe('Add device group', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add device group', () => {
    cy.developerUserLogin().wait(20000);
    cy.addDeviceGroup();
  });
});
