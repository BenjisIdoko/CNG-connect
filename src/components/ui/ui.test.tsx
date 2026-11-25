import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './button';
import { Badge } from './badge';
import { Input } from './input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Separator } from './separator';

describe('admin ui kit', () => {
  it('Button default carries the mint action background and ink text', () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html).toContain('bg-adm-foil');
    expect(html).toContain('text-adm-ink');
    expect(html).toContain('type="button"');
  });

  it('Button destructive is not mint, and secondary is green with white text', () => {
    const destructive = renderToStaticMarkup(<Button variant="destructive">Delete</Button>);
    expect(destructive).toContain('bg-adm-danger');
    expect(destructive).not.toContain('bg-adm-foil');
    const secondary = renderToStaticMarkup(<Button variant="secondary">Back</Button>);
    expect(secondary).toContain('bg-adm-note');
    expect(secondary).toContain('text-white');
  });

  it('Button passes disabled and a custom class through', () => {
    const html = renderToStaticMarkup(
      <Button disabled className="w-full">
        Wait
      </Button>,
    );
    expect(html).toContain('disabled');
    expect(html).toContain('w-full');
  });

  it('Badge new uses the pale yellow tint and the others do not', () => {
    expect(renderToStaticMarkup(<Badge variant="new">New</Badge>)).toContain('bg-adm-new');
    expect(renderToStaticMarkup(<Badge variant="secondary">Old</Badge>)).not.toContain('bg-adm-new');
  });

  it('Table renders a semantic table with thead and tbody', () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Station</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-state="new">
            <TableCell>NIPCO Jahi</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(html).toContain('<table');
    expect(html).toContain('<thead');
    expect(html).toContain('<tbody');
    expect(html).toContain('<th');
    expect(html).toContain('data-state="new"');
  });

  it('Input forwards its accessible label', () => {
    const html = renderToStaticMarkup(<Input aria-label="Manager email" placeholder="manager@example.com" />);
    expect(html).toContain('aria-label="Manager email"');
    expect(html).toContain('type="text"');
  });

  it('Separator is a hairline with a role', () => {
    const html = renderToStaticMarkup(<Separator />);
    expect(html).toContain('role="separator"');
    expect(html).toContain('h-px');
  });
});
