import 'cypress-file-upload';
Cypress.Commands.add('addReservation', function () {
  cy.fixture('add-reservation.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy.get(step.selector).click().wait(1000);

        case 'type':
          return cy
            .get(step.selector)
            .should('be.visible')
            .type(step.value, { force: true });

        case 'select':
          return cy
            .get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .click('center', { force: true });

        case 'check':
          return cy.get(step.selector).eq(step.index).click().wait(10000);
      }
    });
  });
});
