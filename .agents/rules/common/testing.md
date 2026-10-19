# Testing Requirements

## Minimum Test Coverage: 80%

Test Types (ALL required):
1. **Unit Tests** - Individual functions, utilities, components
2. **Integration Tests** - API endpoints, database operations
3. **E2E Tests** - Critical user flows (framework chosen per language)

## Test-Driven Development

MANDATORY workflow:
1. Write test first (RED)
2. Run test - it should FAIL
3. Write minimal implementation (GREEN)
4. Run test - it should PASS
5. Refactor (IMPROVE)
6. Verify coverage (80%+)

## Troubleshooting Test Failures

1. Use **tdd-guide** agent
2. Check test isolation
3. Verify mocks are correct
4. Fix implementation, not tests (unless tests are wrong)

## Agent Support

- **tdd-guide** - Use PROACTIVELY for new features, enforces write-tests-first

## Test Structure (AAA Pattern)

Prefer Arrange-Act-Assert structure for tests:

```typescript
test('calculates similarity correctly', () => {
  // Arrange
  const vector1 = [1, 0, 0]
  const vector2 = [0, 1, 0]

  // Act
  const similarity = calculateCosineSimilarity(vector1, vector2)

  // Assert
  expect(similarity).toBe(0)
})
```

### Test Naming

Use descriptive names that explain the behavior under test:

```typescript
test('returns empty array when no markets match query', () => {})
test('throws error when API key is missing', () => {})
test('falls back to substring search when Redis is unavailable', () => {})
```

## Testing Honesty (distilled predecessor lessons, portable)

1. **Name the tier of every claim**: when reporting "tests pass", state what was actually exercised (unit / integration / E2E / human-verified). An interaction or visual surface that no automated test covers must be reported as "not verified", never implied by green unit tests.
2. **No observable assertions on HashMap/set iteration order**: green in a single local run, red in a full CI run. Lock deterministic semantics by counts/contents, not order; re-run a flaky-suspect test ~5x before committing.
3. **A gate that greps must prove it can bite**: before trusting a new grep-based check, run it once against a known-positive sample; a pattern that never matches is a permanently green false gate. Gate commands must not end in a pipe (the pipe's exit code masks the command's failure).

## Runnable Check

```bash
# Tier structure + red-lines defined in docs/test-matrix.md (D6). Runner commands land with T1 CI at scaffold (see mvp-checklist F1).
echo 'test matrix defined (docs/test-matrix.md); runner wiring lands at scaffold — see mvp-checklist F1'
```
