export const CONSENT_KEY = 'traverse_privacy_accepted';
export const CONSENT_EVENT = 'traverse:consent-granted';

export function hasConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === '1';
}

export function grantConsent(): void {
  localStorage.setItem(CONSENT_KEY, '1');
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
