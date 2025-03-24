import 'cypress-file-upload';

Cypress.Commands.add('accountSettings', function () {
  cy.fixture('account-settings.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          cy.get(step.selector).click().wait(1000);
          break;

        case 'type':
          cy.get(step.selector)
            .should('be.visible')
            .clear({ force: true })
            .type(step.value, { force: true });
          break;
      }
    });
  });
});
