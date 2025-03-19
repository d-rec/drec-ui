import 'cypress-file-upload';

Cypress.Commands.add('certificate', function () {
  cy.fixture('certificate.json').then((data) => {
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
    });
  });
});
