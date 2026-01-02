import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';

describe('AuthStore', () => {
  beforeEach(async () => {
    await useAuthStore.persist?.clearStorage?.();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with empty state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should login user successfully', async () => {
    const mockUser = { id: '1', username: 'testuser', email: 'test@example.com' };
    const mockToken = 'test-jwt-token';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          user: mockUser,
          accessToken: mockToken,
          refreshToken: 'refresh-token',
        },
      }),
    } as Response);

    await useAuthStore.getState().login('test@example.com', 'password123');

    expect(fetchSpy).toHaveBeenCalled();
    const newState = useAuthStore.getState();
    expect(newState.user).toEqual(mockUser);
    expect(newState.accessToken).toBe(mockToken);
    expect(newState.refreshToken).toBe('refresh-token');
    expect(newState.isAuthenticated).toBe(true);
    expect(newState.error).toBeNull();
  });

  it('should logout user', () => {
    useAuthStore.setState({
      user: { id: '1', username: 'tester' },
      accessToken: 'token-123',
      refreshToken: 'refresh-456',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set error', () => {
    useAuthStore.getState().setError('Test error message');
    expect(useAuthStore.getState().error).toBe('Test error message');
  });

  it('should set loading state', () => {
    const store = useAuthStore.getState();
    store.setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);

    store.setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('should update tokens via setToken', () => {
    useAuthStore.getState().setToken('token-abc', 'refresh-xyz');
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('token-abc');
    expect(state.refreshToken).toBe('refresh-xyz');
  });
});
