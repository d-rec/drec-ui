// // cypress/support/mock-email-service.ts
// export class MockEmailService {
//   private emails: Record<string, { code: string; sentAt: Date }> = {};

//   sendVerificationEmail(email: string) {
//     const code = Math.random().toString(36).substring(7);
//     this.emails[email] = {
//       code,
//       sentAt: new Date(),
//     };
//     return Promise.resolve({ success: true });
//   }

//   verifyCode(email: string, code: string) {
//     const storedCode = this.emails[email]?.code;
//     return Promise.resolve({
//       isValid: storedCode === code,
//       code: storedCode,
//     });
//   }

//   getCode(email: string) {
//     return this.emails[email]?.code || null;
//   }

//   clear(email: string) {
//     delete this.emails[email];
//   }

//   clearAll() {
//     this.emails = {};
//   }
// }

// export const mockEmailService = new MockEmailService();

export const mockEmailService = {
  async getLatestEmail(emailAddress: string) {
    const response = await fetch('http://localhost:1080/email'); // MailDev endpoint
    const emails = await response.json();

    return emails.find((email: any) => email.to[0].address === emailAddress);
  },

  extractVerificationLink(email: any): string {
    const linkRegex = /(http[s]?:\/\/[^\s]+)/g;
    const matches = email?.text?.match(linkRegex);
    if (!matches || matches.length === 0) {
      throw new Error('No verification link found in email');
    }
    return matches[0];
  },
};
