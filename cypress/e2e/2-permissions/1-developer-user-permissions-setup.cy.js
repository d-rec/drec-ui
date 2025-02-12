describe('Setup developer user role permissions', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should setup developer user role permissions', () => {
    cy.adminLogin().wait(10000);
    cy.developerUserPermissionsSetup();
  });
});
