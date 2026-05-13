// Biometric (WebAuthn / Passkey) buffer helpers + CSAT URL builder.
// Originally inlined in App.jsx; isolated here because they are pure
// utilities with no React dependency.

export const bufferToBase64url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let char of bytes) str += String.fromCharCode(char);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

export const generateRandomBuffer = (length) => {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return array;
};

export const buildCsatUrl = (token) => {
  return `${window.location.origin}/?csat=${encodeURIComponent(token)}`;
};
