import { describe, expect, it } from 'vitest';
import { buildInviteEmail } from './invite-manager';

describe('buildInviteEmail', () => {
  const email = buildInviteEmail({ stationName: 'NNPC filling station ushafa', signInUrl: 'https://cngconnect.com.ng/station-manager' });

  it('names the station in the subject and both bodies', () => {
    expect(email.subject).toBe('You can manage NNPC filling station ushafa on CNG-Connect');
    expect(email.text).toContain('NNPC filling station ushafa');
    expect(email.html).toContain('NNPC filling station ushafa');
  });

  it('links to the manager sign-in and says a code comes next', () => {
    expect(email.text).toContain('https://cngconnect.com.ng/station-manager');
    expect(email.html).toContain('href="https://cngconnect.com.ng/station-manager"');
    expect(email.text.toLowerCase()).toContain('code');
    expect(email.text.toLowerCase()).toContain('same email');
  });

  it('never includes a sign-in code or password', () => {
    expect(email.text).not.toMatch(/\b\d{6,10}\b/);
  });

  it('escapes markup in the station name so it cannot inject HTML', () => {
    const evil = buildInviteEmail({ stationName: '<script>alert(1)</script> & Co', signInUrl: 'https://cngconnect.com.ng/station-manager' });
    expect(evil.html).not.toContain('<script>');
    expect(evil.html).toContain('&lt;script&gt;');
    expect(evil.html).toContain('&amp; Co');
  });

  it('strips line breaks from the subject', () => {
    const odd = buildInviteEmail({ stationName: 'A\r\nBcc: x@y.z', signInUrl: 'https://cngconnect.com.ng/station-manager' });
    expect(odd.subject).not.toMatch(/[\r\n]/);
  });
});
