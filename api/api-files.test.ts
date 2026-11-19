import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// A relative import between files under api/ builds fine and passes tests, then crashes in production
// with ERR_MODULE_NOT_FOUND (the package is "type": "module" and Vercel does not bundle the helper).
describe('serverless functions under api/', () => {
  const dir = __dirname;
  const functions = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  it('has at least the functions we ship', () => {
    expect(functions).toEqual(expect.arrayContaining(['chat.ts', 'invite-manager.ts']));
  });

  it.each(functions)('%s imports no sibling files', (file) => {
    const source = readFileSync(join(dir, file), 'utf8');
    expect(source).not.toMatch(/from\s+['"]\.{1,2}\//);
  });
});
