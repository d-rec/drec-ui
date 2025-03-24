import 'cypress-file-upload';
Cypress.Commands.add('addReservation', function () {
  cy.fixture('add-reservation.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          cy.get(step.selector).click();
          break;

        case 'type':
          cy.get(step.selector)
            .should('be.visible')
            .type(step.value, { force: true });
          break;

        case 'select':
          cy.get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .click('center', { force: true });
          break;

        case 'check':
          cy.get(step.selector).eq(step.index).click();
          break;
      }
    });
  });
});
