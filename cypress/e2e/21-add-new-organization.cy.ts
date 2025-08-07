describe('Add new organization', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('Should add new organization', () => {
    cy.adminLogin();
    cy.wait(2000);
    cy.addNewOrganization();
  });
});
