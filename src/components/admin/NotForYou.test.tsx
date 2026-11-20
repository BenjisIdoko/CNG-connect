import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NotForYou } from './NotForYou';

describe('NotForYou', () => {
  it('shows the title, the message and a way back to the app', () => {
    const html = renderToStaticMarkup(
      <NotForYou
        title="This page is for the app admin"
        message="You're signed in, but this dashboard is only for the app admin."
        linkLabel="Back to CNG-Connect"
        linkHref="/"
        onSignOut={() => undefined}
      />,
    );
    expect(html).toContain('This page is for the app admin');
    expect(html).toContain("only for the app admin");
    expect(html).toContain('href="/"');
    expect(html).toContain('Back to CNG-Connect');
    expect(html).toContain('Sign out');
  });
});
