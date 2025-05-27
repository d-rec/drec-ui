describe('setup buyer user role permissions', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('Should setup buyer user role permissions', () => {
    cy.loginViaAPI('anny@gmail.com', 'pass123');
  });
});
