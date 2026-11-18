import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NotForYou } from './NotForYou';

describe('NotForYou', () => {
  it('shows the title, the message and a link to the right entrance', () => {
    const html = renderToStaticMarkup(
      <NotForYou
        title="This page is for the app admin"
        message="You're signed in, but this dashboard is only for the app admin."
        linkLabel="Go to the station manager page"
        linkHref="/station-manager"
        onSignOut={() => undefined}
      />,
    );
    expect(html).toContain('This page is for the app admin');
    expect(html).toContain("only for the app admin");
    expect(html).toContain('href="/station-manager"');
    expect(html).toContain('Go to the station manager page');
    expect(html).toContain('Sign out');
  });
});
