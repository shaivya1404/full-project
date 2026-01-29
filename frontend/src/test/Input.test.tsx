import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../components/Input';

describe('Input Component', () => {
  it('should render input field', () => {
    render(<Input data-testid="input-field" />);
    expect(screen.getByTestId('input-field')).toBeInTheDocument();
  });

  it('should render with label', () => {
    render(<Input label="Username" data-testid="input-field" />);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('should handle value changes', async () => {
    render(<Input data-testid="input-field" />);
    const input = screen.getByTestId('input-field') as HTMLInputElement;

    await userEvent.type(input, 'test value');
    expect(input.value).toBe('test value');
  });

  it('should display error message', () => {
    render(
      <Input
        label="Username"
        error="Username is required"
        data-testid="input-field"
      />
    );
    expect(screen.getByText('Username is required')).toBeInTheDocument();
  });

  it('should apply error styling when error exists', () => {
    render(
      <Input
        error="Username is required"
        data-testid="input-field"
      />
    );
    const input = screen.getByTestId('input-field');
    expect(input).toHaveClass('border-red-500');
  });

  it('should support placeholder', () => {
    render(
      <Input
        placeholder="Enter your username"
        data-testid="input-field"
      />
    );
    expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <Input
        disabled
        data-testid="input-field"
      />
    );
    expect(screen.getByTestId('input-field')).toBeDisabled();
  });

  it('should support different input types', () => {
    const { rerender } = render(
      <Input type="text" data-testid="input-field" />
    );
    expect(screen.getByTestId('input-field')).toHaveAttribute('type', 'text');

    rerender(<Input type="password" data-testid="input-field" />);
    expect(screen.getByTestId('input-field')).toHaveAttribute('type', 'password');

    rerender(<Input type="email" data-testid="input-field" />);
    expect(screen.getByTestId('input-field')).toHaveAttribute('type', 'email');
  });
});
