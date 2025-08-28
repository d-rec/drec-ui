describe('Filter and Edit Api Users', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should Filter and Edit Api Users', () => {
    cy.adminLogin().wait(2000);
    cy.filterAndEditApiUsers();
  });
});
