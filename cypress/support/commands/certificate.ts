import 'cypress-file-upload';

Cypress.Commands.add('certificate', function () {
  cy.fixture('certificate.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          cy.get(step.selector).click().wait(1000);
          break;
        case 'type':
          cy.get(step.selector)
            .should('be.visible')
            .type(step.value, { force: true });
      }
    });
  });
});
