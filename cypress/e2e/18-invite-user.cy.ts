describe('Add device Test', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add new device', () => {
    cy.buyerUserLogin().wait(6000);
    cy.inviteUser();
  });
});
