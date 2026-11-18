import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Flag, MapPinned } from 'lucide-react';
import { AdminSidebarLayout } from './AdminSidebarLayout';

const render = (activeKey = 'reports') =>
  renderToStaticMarkup(
    <AdminSidebarLayout
      brand="CNG-Connect"
      navItems={[
        { key: 'stations', label: 'Stations', icon: MapPinned },
        { key: 'reports', label: 'Report moderation', icon: Flag, badge: 4 },
      ]}
      activeKey={activeKey}
      onSelect={() => undefined}
      userEmail="owner@example.com"
      onSignOut={() => undefined}
      onExit={() => undefined}
    >
      <p>panel body</p>
    </AdminSidebarLayout>,
  );

describe('AdminSidebarLayout', () => {
  it('renders every nav item with its label and a badge count', () => {
    const html = render();
    expect(html).toContain('Stations');
    expect(html).toContain('Report moderation');
    expect(html).toContain('>4<');
  });

  it('marks the active item with aria-current="page" and no other', () => {
    const html = render('reports');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="page"[\s\S]{0,900}?Report moderation/);
  });

  it('shows the signed-in email, Sign out and Back to app', () => {
    const html = render();
    expect(html).toContain('owner@example.com');
    expect(html).toContain('Sign out');
    expect(html).toContain('Back to app');
  });

  it('uses the active item label as the page heading and renders the panel', () => {
    const html = render('stations');
    expect(html).toContain('<h1');
    expect(html.slice(html.indexOf('<h1'))).toContain('Stations');
    expect(html).toContain('panel body');
  });

  it('offers a menu button for phones and wraps everything in the admin theme', () => {
    const html = render();
    expect(html).toContain('aria-label="Open menu"');
    expect(html).toContain('admin-ui');
  });
});
