describe('User Account Update', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should updates username, email, and password successfully', () => {
    cy.admin_login().wait(20000);
    cy.account_settings();
  });
});
