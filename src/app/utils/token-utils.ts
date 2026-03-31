/**
 * Utility functions for token handling
 */
export function padBase64(token: string): string {
  return token.replace('-', '+').replace('_', '/');
}

export function b64DecodeUnicode(token: string): string {
  return window.atob(token);
}

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

export function storeUserSession(accessToken: string, userData?: any): void {
  sessionStorage.setItem('access-token', accessToken);

  const jwtObj = decodeJwtToken(accessToken);
  if (jwtObj) {
    sessionStorage.setItem('loginuser', JSON.stringify(jwtObj));
  }

  if (userData) {
    if (userData.status) {
      sessionStorage.setItem('status', userData.status);
    }

    if (userData.api_user_id) {
      sessionStorage.setItem('apiuserId', userData.api_user_id);
    }

    // Merge profile data (organization, etc.) into the stored loginuser
    if (jwtObj) {
      const merged = { ...jwtObj, ...userData };
      sessionStorage.setItem('loginuser', JSON.stringify(merged));
    }
  }
}
