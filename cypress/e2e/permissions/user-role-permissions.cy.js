describe('Add user role permissions', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('Add user role permissions', () => {
    cy.adminlogin();
    cy.permissions();
  });
});
