import test from 'tape-six';

test('smoke: package loads', async t => {
  const pkg = await import('dynamodb-toolkit-lambda');
  t.ok(pkg, 'package resolves');
});
