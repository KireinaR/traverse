import { useEffect, useState } from 'react';
import { hasConsent, grantConsent } from '../../lib/consent';

export default function PrivacyModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasConsent());
  }, []);

  if (!visible) return null;

  const accept = () => {
    grantConsent();
    setVisible(false);
  };

  return (
    <div className="privacy-modal-backdrop">
      <div className="privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-modal-title">
        <h2 id="privacy-modal-title" className="privacy-modal-title">Before you start</h2>
        <p className="privacy-modal-text">
          Traverse asks for your location on load <strong>only</strong> to center the map on your city. Here's exactly what that means:
        </p>
        <ul className="privacy-modal-list">
          <li>Your coordinates are used once, locally in your browser, and are never sent to our servers or stored anywhere.</li>
          <li>If you deny access or it fails, the map just falls back to a default view — nothing else changes.</li>
          <li>Search queries you type are sent to OpenStreetMap's Nominatim service to find matching places.</li>
          <li>No accounts, no cookies, no analytics, no tracking.</li>
        </ul>
        <a
          className="privacy-modal-link"
          href="https://github.com/KireinaR/traverse/blob/main/PRIVACY.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read the full privacy policy →
        </a>
        <button className="privacy-modal-btn" onClick={accept} autoFocus>OKAY</button>
      </div>
    </div>
  );
}
