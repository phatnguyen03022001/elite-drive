const migration = require('../../scripts/drop-refund-order-id-index.cjs');

describe('refund index migration CLI output', () => {
  it('reports migration-required for check mode with a legacy match', () => {
    expect(migration.formatSuccessResult({
      mode: 'check',
      classification: 'LEGACY_MATCH',
      mutated: false,
    })).toBe('migration-required');
  });

  it('reports removed for a verified apply of a legacy match', () => {
    expect(migration.formatSuccessResult({
      mode: 'apply',
      classification: 'LEGACY_MATCH',
      mutated: true,
    })).toBe('removed');
  });

  it('reports already-absent for an absent index in either mode', () => {
    expect(migration.formatSuccessResult({
      mode: 'check',
      classification: 'ABSENT',
      mutated: false,
    })).toBe('already-absent');
    expect(migration.formatSuccessResult({
      mode: 'apply',
      classification: 'ABSENT',
      mutated: false,
    })).toBe('already-absent');
  });

  it('uses conservative wording when apply state is unverified', () => {
    expect(migration.safeFailureMessage()).toContain('database state is not asserted');
    expect(migration.safeFailureMessage()).toContain('Re-run --check');
    expect(migration.safeFailureMessage()).not.toContain('no mutation was performed');
  });
});
