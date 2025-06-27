import 'cypress-file-upload';
const EVIDENT_API_KEY = Cypress.env('EVIDENT_API_KEY');
const EVIDENT_EMAIL = Cypress.env('EVIDENT_EMAIL');

Cypress.Commands.add('deviceRegistrationOnEvident', function () {
  return cy.fixture('device-registration-on-evident.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          return cy
            .get(step.selector)
            .clear()
            .type(
              step.index === 0
                ? EVIDENT_API_KEY
                : step.index === 1
                  ? EVIDENT_EMAIL
                  : step.value,
            );
        case 'click':
          return cy.get(step.selector).click();
      }
    });
  });
});
