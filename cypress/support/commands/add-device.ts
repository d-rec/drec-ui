import 'cypress-file-upload';
Cypress.Commands.add('addDevice', function () {
  cy.fixture('add-device.json').then((data) => {
    const new_data = data.map((d) =>
      d.selector === "[test-id='external-id']"
        ? { ...d, value: Math.floor(Math.random() * 200) }
        : { ...d },
    );
    new_data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy
            .get(step.selector)
            .click({ multiple: true, force: true })
            .wait(1000);
        case 'type':
          return cy.get(step.selector).should('be.visible').type(step.value);

        case 'write':
          return cy
            .get(step.selector)
            .should('be.visible')
            .clear()
            .type(step.value + '{enter}')
            .wait(1000);

        case 'select':
          if (step.option === "[test-id='country-options']") {
            return cy
              .get(step.selector)
              .click({ force: true })
              .get(step.option)
              .contains('Rwanda')
              .click()
              .wait(1000);
          } else {
            return cy
              .get(step.selector)
              .click()
              .get(step.option)
              .should('have.length.greaterThan', 0)
              .eq(0)
              .click()
              .wait(1000);
          }

        case 'upload':
          return cy
            .get(step.selector)
            .should('exist')
            .each(($input) => {
              cy.wrap($input).attachFile('files/device-document-upload.pdf', {
                force: true,
              });
            });

        case 'agree':
          return cy
            .get(step.selector)
            .click('center', { force: true })
            .wait(5000);
      }
    });
  });
});
