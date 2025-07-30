import 'cypress-file-upload';
Cypress.Commands.add('filterAndEditApiUsers', function () {
  cy.fixture('filter-and-edit-api-users.json').then((data) => {
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
        case 'filter':
          return cy.get(step.selector).click().wait(1000);
        case 'write':
          return cy
            .get(step.selector)
            .clear()
            .type(step.value, { force: true });
      }
    });
  });
});
