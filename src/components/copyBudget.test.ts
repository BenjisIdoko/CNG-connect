import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Copy earns its place. Text that restates its heading, repeats a hint printed elsewhere, or explains a control
 * that explains itself was cut (impeccable "distill"). This keeps it cut: a phrase below must not come back,
 * and the warnings a person needs to decide (deletes, photo rules) must stay.
 */
const SRC = join(__dirname, '..');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

const files = walk(SRC).map((path) => ({ name: relative(SRC, path), text: readFileSync(path, 'utf8') }));
const everywhere = (needle: string) => files.filter((f) => f.text.includes(needle)).map((f) => f.name);
const source = (name: string) => files.find((f) => f.name === name)?.text ?? '';

/** Phrases that were filler. Each one is said by its heading, its button, or the screen itself. */
const CUT = [
  // booking
  'Pi-CNG Booking Confirmed',
  'Conversion Appointment Booked!',
  'Driver Reward Points added to your profile',
  'Done & Return',
  'Confirm Conversion Appointment',
  'Selected Workshop (',
  // community
  'Each station has one group for pump status',
  'Nationwide Driver Leaderboard',
  'Top drivers earning reputation points',
  'No station groups match your current search query',
  // empty states that repeat the button under them
  'Try another state or clear your search',
  'Try a different search or clear the filters',
  'Try just the station name or the city',
  'Nothing matches your filters right now',
  // password
  'Your password has been updated',
  'Choose a password for your account',
  // sharing a post or photo
  'Anti-Misinformation Verified',
  'Live photos carry a burned-in timestamp',
  'gallery uploads blocked',
  'Only live camera photos taken at the station appear here',
  'Say hi to drivers here',
  'Add what you paid when you report',
  // forms and settings
  'Help build Nigeria',
  'From a friend who shared the app with you',
  'Nigerian number, e.g.',
  'Auto follows your phone',
  "It's the fastest way to Verified Reporter",
  // system messages
  'Checks that alerts reach this phone',
  'Reload to get the latest station reports',
  'cached for offline driving',
  'Showing cached station map and data',
  // toasts that read like debug output
  'Geofence Nudge',
  'Geofence Alert',
  'Nudges require',
  'Navigation summary for',
  // navigation sheet labels
  'Estimated Distance',
  'Drive Time ETA',
  'Turn-by-Turn Navigation',
  'Close Summary',
  // tank options overflowed a phone-width select
  'Recommended for Sedans',
  'Ultra Light Cylinder (Premium)',
  'Commercial Buses',
  // sign in: the title already says "sign in or sign up"
  'The same code creates your account',
  // a station nobody has reported on asked for a report five ways on one screen; the strip asks once
  'Be the first to tell drivers',
  'Be the first to report stock',
  'it may have changed since',
  'No report in the last 45 min',
  // location notice: say what is wrong and what to do, once
  'blocked for this site',
  "If this isn't where you are",
  // install banner: the title says it, and the subtitle was cut off on every phone
  'Full-screen, works offline',
  'icon appears on your home screen',
  // tagline chips and kickers
  'Clean Mobility',
  'Accredited Workshop',
  // admin
  'Live footprint across stations',
  'Click any cell to edit inline',
  'Review driver-submitted stations',
  'it shows up here',
  'Search, filter and manage driver accounts',
  'Basics and a map position',
  'The app hides stations whose names match',
  'Check before adding.',
  'They use the normal driver app',
  'Admin Operations',
  'No Google Maps key is set here',
];

describe('copy that was cut stays cut', () => {
  it.each(CUT)('"%s" is not in the UI', (phrase) => {
    expect(everywhere(phrase)).toEqual([]);
  });

  it('does not label the desktop sidebar groups, or print a placeholder role under a guest', () => {
    const sidebar = source('components/common/Sidebar.tsx');
    expect(sidebar).not.toMatch(/>\s*Navigation\s*</);
    expect(sidebar).not.toMatch(/>\s*Smart Tools\s*</);
    expect(sidebar).not.toContain("|| 'Driver'");
  });

  it('keeps a hidden dashboard description for screen readers rather than printing it', () => {
    const layout = source('components/admin/AdminSidebarLayout.tsx');
    expect(layout).toMatch(/<SheetDescription className="sr-only">/);
  });
});

describe('copy that decides something stays', () => {
  it('still says a delete cannot be undone, and what it takes with it', () => {
    expect(source('components/admin/StationsPanel.tsx')).toContain("This permanently deletes each station and its reports, photos, and comments. This can't be undone.");
    expect(source('components/admin/UsersPanel.tsx')).toContain("This permanently deletes their account, profile, reports, and posts. This can't be undone.");
  });

  it('still tells the driver a photo must come from the live camera', () => {
    expect(source('components/ReportStatusModal.tsx')).toContain('Live camera only');
    expect(source('components/CreatePostModal.tsx')).toMatch(/live camera only/i);
  });

  it('still explains why an EV suggestion cannot be approved', () => {
    expect(source('components/admin/SuggestionsPanel.tsx')).toContain("EV stations aren't shown in the app");
  });
});
