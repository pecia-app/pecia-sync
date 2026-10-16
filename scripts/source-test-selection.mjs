export function parseArchiveListing(output) {
  // Windows tar emits CRLF; keep path bytes intact apart from line delimiters.
  return output.split(/\r?\n/).filter(Boolean);
}

export function frontendTestArgs(names) {
  const tests=names.filter(name=>/^project\/src\/lib\/[^/]+\.test\.ts$/.test(name)).map(name=>name.slice(8)).sort();
  // An empty --test invocation discovers unrelated scripts, including browser tests.
  if(!tests.length)throw Error('No frontend unit tests found in source archive');
  return ['node_modules/tsx/dist/cli.mjs','--test',...tests];
}
