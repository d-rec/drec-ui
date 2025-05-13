/// <reference types="cypress" />

interface CustomInbox {
  id: string;
  fullEmailAddress: string;
  shortEmailAddress: string;
}

declare global {
  namespace Cypress {
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

      // ✅ Correctly typed Mailosaur helpers
      createTestInbox(): Cypress.Chainable<CustomInbox>;
      waitForVerificationEmail(args: {
        serverId: string;
        emailAddress: string;
      }): Cypress.Chainable<any>; // Correct argument type
    }
  }
}

export {};
