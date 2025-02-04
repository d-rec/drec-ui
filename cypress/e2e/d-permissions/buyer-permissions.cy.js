describe('Test Buyer User Permissions', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('Should assign and verify buyer role permissions', () => {
    cy.admin_login();

    cy.buyer_permissions();
  });
});
