describe('Update user', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('Should update user', () => {
    cy.adminLogin();
    cy.wait(2000);
    cy.updateUser();
  });
});
