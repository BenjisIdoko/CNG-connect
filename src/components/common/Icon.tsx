import React from 'react';

/**
 * Material Symbols glyph (self-hosted subset font — see scripts/build-icon-font.mjs).
 * Any new `name` must be added to scripts/icon-names.json and the font rebuilt;
 * src/utils/iconNames.test.ts fails the build if one is missing.
 */
export const Icon: React.FC<{
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
}> = ({ name, size = 20, fill = false, className = '', style }) => (
  <span
    aria-hidden
    className={`material-symbols-outlined ${fill ? 'material-symbols-fill' : ''} ${className}`}
    style={{ fontSize: size, ...style }}
  >
    {name}
  </span>
);
