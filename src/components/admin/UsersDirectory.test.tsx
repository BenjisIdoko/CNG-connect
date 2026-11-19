import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DirectoryRow, UsersDirectory } from './UsersDirectory';

const row = (patch: Partial<DirectoryRow>): DirectoryRow => ({
  id: patch.id ?? 'u1',
  name: 'Adewale Fajana',
  email: 'adewale@example.com',
  phone: '08031234567',
  state: 'Lagos',
  vehicle: 'Toyota Corolla',
  cng_kit: '12kg cylinder, installed',
  reports_count: 12,
  reputation_score: 4.5,
  community_points: 340,
  is_admin: false,
  ...patch,
});

const noop = () => undefined;
const render = (rows: DirectoryRow[], loading = false) =>
  renderToStaticMarkup(<UsersDirectory rows={rows} loading={loading} onEdit={noop} onDelete={noop} flash={noop} />);

describe('UsersDirectory', () => {
  const rows = [
    row({ id: '1' }),
    row({ id: '2', name: 'Oluwaranti Fajana', email: 'ranti@example.com', state: 'Abuja', is_admin: true }),
    row({ id: '3', name: null, email: 'noname@example.com', cng_kit: '', state: null }),
  ];

  it('shows the title, the user count and the description', () => {
    const html = render(rows);
    expect(html).toContain('User directory');
    expect(html).toContain('3 users');
    expect(html).toContain('Search, filter and manage driver accounts');
  });

  it('shows search, role and state filters, a kit chip row and an export button', () => {
    const html = render(rows);
    expect(html).toContain('aria-label="Search users"');
    expect(html).toContain('aria-label="Role"');
    expect(html).toContain('aria-label="State"');
    expect(html).toContain('>Abuja<');
    expect(html).toContain('>12kg cylinder, installed<');
    expect(html).toContain('Not installed yet');
    expect(html).toContain('Export CSV');
  });

  it('shows sortable headings with the name column sorted ascending by default', () => {
    const html = render(rows);
    expect(html).toContain('aria-sort="ascending"');
    expect(html).toContain('>User<');
    expect(html).toContain('>Activity<');
  });

  it('draws avatar initials, the phone, the Admin badge and the activity line', () => {
    const html = render(rows);
    expect(html).toContain('>AF<');
    expect(html).toContain('08031234567');
    expect(html).toContain('>Admin<');
    expect(html).toContain('12 reports');
    expect(html).toContain('4.5 rating · 340 pts');
    expect(html).toContain('(no name)');
  });

  it('gives every row an accessible edit and delete button', () => {
    const html = render(rows);
    expect(html).toContain('aria-label="Edit Adewale Fajana"');
    expect(html).toContain('aria-label="Delete Adewale Fajana"');
    expect(html).toContain('aria-label="Edit noname@example.com"');
  });

  it('shows the page summary and disables the first and previous buttons on page one', () => {
    const html = render(rows);
    expect(html).toContain('Rows per page:');
    expect(html).toContain('Page 1 of 1 (3 users)');
    expect(html).toMatch(/aria-label="First page"[^>]*disabled|disabled=""[^>]*aria-label="First page"/);
  });

  it('shows an empty state when there are no accounts', () => {
    const html = render([]);
    expect(html).toContain('No accounts yet');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('Rows per page');
  });

  it('shows skeletons instead of the table while loading', () => {
    const html = render([], true);
    expect(html).toContain('aria-label="Loading users"');
    expect(html).not.toContain('<table');
  });

  it('labels accounts that manage a station with a Station manager badge, and no one else', () => {
    const html = renderToStaticMarkup(
      <UsersDirectory rows={rows} loading={false} onEdit={noop} onDelete={noop} flash={noop} managerIds={new Set(['3'])} />,
    );
    expect(html.match(/>Station manager</g)).toHaveLength(1);
    expect(render(rows)).not.toContain('Station manager');
  });
});
