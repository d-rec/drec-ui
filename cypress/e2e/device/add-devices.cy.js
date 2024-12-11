describe('Add divice Test', () => {
    beforeEach(()=>{
      cy.wait(1000);
    })
    it('should add new divice', () => {
      cy.devlogin().wait(6000);
      cy.addDevice();
    });
  });