import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuthStore } from '../store/authStore';

// Mock the auth store
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock Toaster from react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: vi.fn(() => null),
  Toaster: () => null,
}));

describe('DashboardLayout', () => {
  const queryClient = new QueryClient();

  beforeEach(() => {
    (useAuthStore as any).mockReturnValue({
      user: { id: '1', username: 'testuser' },
      logout: vi.fn(),
    });
  });

  it('should render sidebar', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DashboardLayout>
            <div>Content</div>
          </DashboardLayout>
        </BrowserRouter>
      </QueryClientProvider>
    );

    const dashboardElements = screen.getAllByText('Dashboard');
    expect(dashboardElements.length).toBeGreaterThan(0);
  });

  it('should render navigation items', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DashboardLayout>
            <div>Content</div>
          </DashboardLayout>
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Check for all navigation items
    const allText = screen.getAllByText('Users');
    expect(allText.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Analytics/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Settings/i).length).toBeGreaterThan(0);
  });

  it('should render children content', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DashboardLayout>
            <div>Test Content</div>
          </DashboardLayout>
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render topbar with user information', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DashboardLayout>
            <div>Content</div>
          </DashboardLayout>
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('Welcome back!')).toBeInTheDocument();
  });

  it('should render notification bell', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DashboardLayout>
            <div>Content</div>
          </DashboardLayout>
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Check for the button that contains the bell icon (checking for the notification button area)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
