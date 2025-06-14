describe('Add device Test', () => {
  beforeEach(() => {
    cy.wait(10000);
  });
  it('should add new device', () => {
    cy.developerUserLogin().wait(60000);
    // cy.adminLogin().wait(6000);
    cy.addDevice();
  });
});
