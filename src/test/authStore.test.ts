import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import Cookies from 'js-cookie';

// Mock js-cookie
vi.mock('js-cookie', () => ({
  default: {
    set: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should login user successfully', () => {
    const mockUser = { id: '1', username: 'testuser', email: 'test@example.com' };
    const mockToken = 'test-jwt-token';

    const state = useAuthStore.getState();
    state.login(mockUser, mockToken);

    const newState = useAuthStore.getState();
    expect(newState.user).toEqual(mockUser);
    expect(newState.token).toBe(mockToken);
    expect(newState.isAuthenticated).toBe(true);
    expect(newState.error).toBeNull();
    expect(Cookies.set).toHaveBeenCalled();
  });

  it('should logout user', () => {
    const mockUser = { id: '1', username: 'testuser' };
    const mockToken = 'test-jwt-token';

    const state = useAuthStore.getState();
    state.login(mockUser, mockToken);

    const loggedInState = useAuthStore.getState();
    expect(loggedInState.isAuthenticated).toBe(true);

    loggedInState.logout();

    const loggedOutState = useAuthStore.getState();
    expect(loggedOutState.user).toBeNull();
    expect(loggedOutState.token).toBeNull();
    expect(loggedOutState.isAuthenticated).toBe(false);
    expect(Cookies.remove).toHaveBeenCalled();
  });

  it('should set error', () => {
    const state = useAuthStore.getState();
    state.setError('Test error message');

    const newState = useAuthStore.getState();
    expect(newState.error).toBe('Test error message');
  });

  it('should set loading state', () => {
    const state = useAuthStore.getState();
    state.setLoading(true);

    const newState = useAuthStore.getState();
    expect(newState.isLoading).toBe(true);

    state.setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('should restore from cookie', () => {
    const mockUser = { id: '1', username: 'testuser' };
    const mockToken = 'test-jwt-token';

    (Cookies.get as any).mockImplementation((key: string) => {
      if (key === 'auth_token') return mockToken;
      if (key === 'auth_user') return JSON.stringify(mockUser);
      return undefined;
    });

    const state = useAuthStore.getState();
    state.restoreFromCookie();

    const newState = useAuthStore.getState();
    expect(newState.user).toEqual(mockUser);
    expect(newState.token).toBe(mockToken);
    expect(newState.isAuthenticated).toBe(true);
  });

  it('should handle invalid cookie data gracefully', () => {
    (Cookies.get as any).mockImplementation((key: string) => {
      if (key === 'auth_token') return 'test-token';
      if (key === 'auth_user') return 'invalid-json';
      return undefined;
    });

    const state = useAuthStore.getState();
    state.restoreFromCookie();

    // Should clear invalid cookies and remain unauthenticated
    expect(Cookies.remove).toHaveBeenCalled();
  });
});
