/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    clearDatabase(): Chainable<void>;
    developerUserSignup(): Chainable<void>;
    buyerUserSignup(): Chainable<void>;
    adminLogin(): Chainable<void>;
    buyerUserPermissionsSetup(): Chainable<void>;
    developerUserPermissionsSetup(): Chainable<void>;
    addDevice(): Chainable<void>;
    addHistoryMeterRead(): Chainable<void>;
    addDeltaMeterRead(): Chainable<void>;
    developerUserLogin(): Chainable<void>;
    addAggregateMeterRead(): Chainable<void>;
    buyerUserLogin(): Chainable<void>;
    addReservation(): Chainable<void>;
    certificate(): Chainable<void>;
    certificateFilter(): Chainable<void>;
    deviceBulkUpload(filename: string): Chainable<void>;
    accountSettings(): Chainable<void>;
    meterReadBulkUpload(filename: string): Chainable<void>;
    certifiedMeterRead(): Chainable<void>;
    inviteUser(): Chainable<void>;
    verifyPhoneNumber(): Chainable<void>;
    mailiskSearchInbox(params: {
      to: string;
      [key: string]: any;
    }): Chainable<any>;
    mailiskGetEmail(id: string): Chainable<any>;
  }
}
