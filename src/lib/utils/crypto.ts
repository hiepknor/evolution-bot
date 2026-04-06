// Obfuscation only; not cryptographic security. Sensitive production setups
// should move API secrets to OS keychain/credential vault.
export const obfuscate = (value: string): string => btoa(unescape(encodeURIComponent(value)));

export const deobfuscate = (value: string): string => {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return '';
  }
};
