/**
 * Utility functions for token handling
 */

/**
 * Fixes the padding of a base64 token for proper decoding
 * @param token The token part to be decoded
 * @returns The properly padded token
 */
export function padBase64(token: string): string {
  return token.replace('-', '+').replace('_', '/');
}

/**
 * Decodes a base64 token to string
 * @param token The padded token to decode
 * @returns Decoded string
 */
export function b64DecodeUnicode(token: string): string {
  return window.atob(token);
}

/**
 * Decodes a JWT token and returns the payload as an object
 * @param token The full JWT token
 * @returns The decoded payload as an object
 */
export function decodeJwtToken(token: string): any {
  try {
    const tokenParts = token.split('.');
    const encodedPayload = tokenParts[1];
    const paddedPayload = padBase64(encodedPayload);
    return JSON.parse(b64DecodeUnicode(paddedPayload));
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    return null;
  }
}

/**
 * Safely stores user session data
 * @param accessToken The JWT access token
 * @param userData Optional user data to store with the token
 */
export function storeUserSession(accessToken: string, userData?: any): void {
  // Store the token
  sessionStorage.setItem('access-token', accessToken);

  // Decode and store user data from token
  const jwtObj = decodeJwtToken(accessToken);
  if (jwtObj) {
    sessionStorage.setItem('loginuser', JSON.stringify(jwtObj));
  }

  // Store additional user data if provided
  if (userData) {
    if (userData.status) {
      sessionStorage.setItem('status', userData.status);
    }

    if (userData.api_user_id) {
      sessionStorage.setItem('apiuserId', userData.api_user_id);
    }
  }
}
