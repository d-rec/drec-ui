import 'cypress-file-upload';
Cypress.Commands.add('addDevice', function () {
  cy.fixture('add-device.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy.get(step.selector).click().wait(1000);

        case 'type':
          return cy.get(step.selector).should('be.visible').type(step.value);

        case 'write':
          return cy
            .get(step.selector)
            .should('be.visible')
            .clear()
            .type(step.value + '{enter}');

        case 'select':
          return cy
            .get(step.selector)
            .click()
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .click();

        case 'submit':
          cy.get(step.selector).click('center', { force: true });
          return cy.contains('Added Successfully !!').should('be.visible');
      }
    });
  });
});
