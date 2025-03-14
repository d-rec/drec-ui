import 'cypress-file-upload';

Cypress.Commands.add('addReservation', function () {
    cy.fixture('add-reservation.js').then((data) => {
      data.forEach((step) => {
        if (step.action === 'click') {
          return cy.get(step.selector).click().wait(1000);
        }
        if (step.action === 'type') {
          return cy
            .get(step.selector)
            .should('be.visible')
            .type(step.value, { force: true });
        }
        if (step.action === 'select') {
          return cy
            .get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .click('center', { force: true });
        }
        if (step.action === 'check') {
          return cy.get(step.selector).eq(step.index).click();
        }
      });
    });
  });