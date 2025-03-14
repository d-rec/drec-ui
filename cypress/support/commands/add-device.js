import 'cypress-file-upload';

Cypress.Commands.add('addDevice', function () {
  cy.fixture('add-device.js').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'type') {
        return cy.get(step.selector).should('be.visible').type(step.value);
      }

      if (step.action === 'write') {
        return cy
          .get(step.selector)
          .should('be.visible')
          .clear()
          .type(step.value + '{enter}');
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click()
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(0)
          .click();
      }
      if (step.action === 'submit') {
        return cy.get(step.selector).click('center', { force: true });
      }
    });
  });
});