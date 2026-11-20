import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommunityGasPostCard } from './CommunityGasPostCard';
import type { GasStation } from '../types';

const station = { id: 's1', name: 'NIPCO Kubwa', lat: 9.07, lng: 7.39 } as GasStation;

const html = renderToStaticMarkup(<CommunityGasPostCard station={station} getFreshPosition={async () => null} onPosted={() => undefined} />);

describe('CommunityGasPostCard', () => {
  it('offers exactly two choices: gas available and gas not available', () => {
    expect(html).toContain('Gas available');
    expect(html).toContain('Gas not available');
    expect((html.match(/<button/g) || []).length).toBe(2);
  });

  it('says who it is for and what it needs', () => {
    expect(html).toContain('Community manager');
    expect(html).toContain('within 150 m');
  });

  it('has big tap targets', () => {
    for (const tag of html.match(/<button[^>]*>/g) || []) expect(tag).toMatch(/min-h-\[48px\]|min-h-\[44px\]|h-14/);
  });
});
