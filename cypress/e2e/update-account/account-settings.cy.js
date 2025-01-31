describe('Add reservation', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add reservation', () => {
    cy.admin_login().wait(20000);
    cy.account_settings();
  });
});
