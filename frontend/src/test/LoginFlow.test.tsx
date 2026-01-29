import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../pages/Login';
import { useAuthStore } from '../store/authStore';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('Login Flow', () => {
  const queryClient = new QueryClient();

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

  const renderLogin = () =>
    render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </BrowserRouter>
    );

  it('should render login form', () => {
    renderLogin();

    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('should display submit button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('should show demo credentials hint', () => {
    renderLogin();

    expect(screen.getByText(/Demo credentials:/i)).toBeInTheDocument();
    expect(screen.getByText(/Email: demo@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Password: demo123/i)).toBeInTheDocument();
  });

  it('should render both email and password inputs', () => {
    renderLogin();

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });
});
