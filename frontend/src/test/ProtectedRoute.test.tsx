import { describe, it, expect } from 'vitest';
import { ProtectedRoute } from '../components/ProtectedRoute';

describe('ProtectedRoute', () => {
  it('should export a ProtectedRoute component', () => {
    expect(ProtectedRoute).toBeDefined();
  });

  it('should be a function', () => {
    expect(typeof ProtectedRoute).toBe('function');
  });

  it('should have a display name or functional signature', () => {
    expect(ProtectedRoute.name).toMatch(/ProtectedRoute/i);
  });
});
