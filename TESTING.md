# Testing Infrastructure

Comprehensive unit testing setup for the Dirt Free CRM application using Jest and React Testing Library.

## Overview

This project uses two types of tests:
- **Unit Tests (Jest)** - Component, utility, and API logic tests
- **E2E Tests (Playwright)** - Full application integration tests

## Unit Testing Setup

### Technologies
- **Jest** - Testing framework
- **@testing-library/react** - React component testing utilities
- **@testing-library/jest-dom** - DOM matchers
- **@testing-library/user-event** - User interaction simulation
- **jest-environment-jsdom** - Browser-like test environment

### Configuration

**jest.config.js** - Main Jest configuration
- Uses Next.js Jest config for proper module resolution
- Excludes Playwright tests and server-only tests
- Coverage thresholds: 70% for branches, functions, lines, statements
- Module name mapping for `@/` imports

**jest.setup.js** - Test environment setup
- Loads `@testing-library/jest-dom` matchers
- Mocks Next.js router and navigation
- Mocks browser APIs (matchMedia, IntersectionObserver, ResizeObserver)
- Suppresses expected console warnings

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm run test:unit:watch

# Run tests with coverage report
npm run test:unit:coverage

# Run tests in CI mode
npm run test:unit:ci
```

### E2E Tests (Playwright)
```bash
# Run E2E tests
npm test

# Run with UI mode
npm run test:ui

# Run specific test file
npm run test:validation
```

### All Tests
```bash
# Run both unit and E2E tests
npm run test:all
```

## Test Structure

```
src/
  __tests__/
    lib/
      loyalty/
        tiers.test.ts
      promotions/
        targeting.test.ts
      api/
        response-helpers.test.ts
      utils/
        formatters.test.ts
  lib/
    test-utils.tsx              # Test utilities and helpers
```

## Test Utilities

### Custom Render Function
```typescript
import { render } from '@/lib/test-utils'

// Renders with all necessary providers
render(<MyComponent />)
```

### Mock Supabase Client
```typescript
import { createMockSupabaseClient } from '@/lib/test-utils'

const mockSupabase = createMockSupabaseClient()
mockSupabase.from('users').select.mockResolvedValue({
  data: [{ id: '1', name: 'Test User' }],
  error: null,
})
```

### Test Data Factories
```typescript
import {
  createMockCustomer,
  createMockJob,
  createMockInvoice,
  createMockUser,
  createMockPromotion,
  createMockLoyaltyCustomer,
  createMockReview,
  createMockOpportunity,
  createMockReferral,
} from '@/lib/test-utils'

// Create test data with defaults
const customer = createMockCustomer()

// Override specific fields
const premiumCustomer = createMockCustomer({
  name: 'Premium Customer',
  lifetime_value: 5000,
})
```

### API Response Helpers
```typescript
import { createSuccessResponse, createErrorResponse } from '@/lib/test-utils'

const successResponse = createSuccessResponse({ id: '123', name: 'Test' })
const errorResponse = createErrorResponse('not_found', 'Resource not found', 404)
```

### Mock Fetch
```typescript
import { mockFetch, createMockFetchResponse } from '@/lib/test-utils'

// Mock successful fetch
mockFetch(createMockFetchResponse({ data: 'test' }))

// Mock fetch error
mockFetchError('Network error')
```

## Example Tests

### Unit Test Example
```typescript
import { describe, it, expect } from '@jest/globals'

describe('Loyalty Tiers', () => {
  it('should qualify for Bronze tier with 0-499 points', () => {
    const points = 250
    const tier = points >= 1000 ? 'Gold' : points >= 500 ? 'Silver' : 'Bronze'

    expect(tier).toBe('Bronze')
  })
})
```

### Component Test Example
```typescript
import { render, screen, fireEvent } from '@/lib/test-utils'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('should render and respond to clicks', () => {
    const handleClick = jest.fn()
    render(<MyComponent onClick={handleClick} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### API Test Example
```typescript
import { createMockSupabaseClient } from '@/lib/test-utils'

describe('API Route', () => {
  it('should return data from database', async () => {
    const mockSupabase = createMockSupabaseClient()
    mockSupabase.from('customers').select.mockResolvedValue({
      data: [{ id: '1', name: 'Test' }],
      error: null,
    })

    // Test your API logic here
  })
})
```

## Coverage Reports

Coverage reports are generated in the `/coverage` directory.

### Viewing Coverage
```bash
# Generate coverage report
npm run test:unit:coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Thresholds
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## Best Practices

### 1. Test Organization
- Keep tests close to the code they test
- Use descriptive test names
- Group related tests with `describe` blocks

### 2. Test Coverage
- Aim for 70%+ coverage on critical paths
- Test edge cases and error conditions
- Test user interactions, not implementation details

### 3. Mocking
- Mock external dependencies (Supabase, APIs)
- Use test data factories for consistent test data
- Don't mock what you own (internal utilities)

### 4. Assertions
- Use specific matchers (`toBe`, `toEqual`, `toHaveLength`)
- Test one thing per test case
- Make assertions meaningful

### 5. Async Testing
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction()
  expect(result).toBe('expected')
})
```

## Debugging Tests

### Run Single Test File
```bash
npm run test:unit -- path/to/test.test.ts
```

### Run Tests Matching Pattern
```bash
npm run test:unit -- --testNamePattern="loyalty"
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Unit Tests
  run: npm run test:unit:ci

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Common Issues

### Issue: Tests timeout
**Solution**: Increase timeout in jest.config.js or individual tests
```typescript
it('long test', async () => {
  // test code
}, 10000) // 10 second timeout
```

### Issue: Module not found
**Solution**: Check moduleNameMapper in jest.config.js

### Issue: Async tests not waiting
**Solution**: Always return promises or use async/await
```typescript
it('should wait', async () => {
  await waitFor(() => expect(element).toBeInTheDocument())
})
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Next.js Testing](https://nextjs.org/docs/testing)

## Test Statistics

Current test suite:
- **Test Suites**: 4 passed
- **Tests**: 74 passed
- **Coverage**: Run `npm run test:unit:coverage` to see current coverage

## Writing New Tests

### 1. Create test file
Place test file next to the code or in `__tests__` directory:
```
src/lib/utils/myUtil.ts
src/lib/utils/__tests__/myUtil.test.ts
```

### 2. Import utilities
```typescript
import { describe, it, expect } from '@jest/globals'
import { render, screen } from '@/lib/test-utils'
```

### 3. Write tests
```typescript
describe('MyUtil', () => {
  it('should do something', () => {
    const result = myUtil('input')
    expect(result).toBe('expected')
  })
})
```

### 4. Run tests
```bash
npm run test:unit
```

## Maintenance

### Updating Snapshots
```bash
npm run test:unit -- -u
```

### Clearing Cache
```bash
npm run test:unit -- --clearCache
```

### Verbose Output
```bash
npm run test:unit -- --verbose
```
