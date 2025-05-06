const verificationCodes = new Map<string, string>();

export const generateOtp = (phoneNumber: string): string => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes.set(phoneNumber, otp);
  return otp;
};

export const getOtp = (phoneNumber: string): string | undefined => {
  return verificationCodes.get(phoneNumber);
};
