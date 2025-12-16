import { render, screen, fireEvent } from '@testing-library/react';
import { CallHistoryTable } from '../components/dashboard/CallHistoryTable';
import { CallDetailsPanel } from '../components/dashboard/CallDetailsPanel';
import type { Call } from '../types';
import { vi, describe, it, expect } from 'vitest';

const mockCalls: Call[] = [
  {
    id: '1',
    caller: 'John Doe',
    agent: 'Agent Smith',
    duration: 120,
    startTime: new Date().toISOString(),
    status: 'completed',
    sentiment: 'positive',
    transcript: 'Hello world',
    recordingUrl: 'http://example.com/rec.mp3'
  },
  {
    id: '2',
    caller: 'Jane Doe',
    agent: 'Agent Smith',
    duration: 60,
    startTime: new Date().toISOString(),
    status: 'missed',
    sentiment: 'negative'
  }
];

describe('CallHistoryTable', () => {
  it('renders calls correctly', () => {
    render(<CallHistoryTable calls={mockCalls} isLoading={false} onSelectCall={() => {}} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('completed', { selector: 'span' })).toBeInTheDocument();
  });

  it('handles row click', () => {
    const onSelectCall = vi.fn();
    render(<CallHistoryTable calls={mockCalls} isLoading={false} onSelectCall={onSelectCall} />);
    
    // Click on a cell in the row
    fireEvent.click(screen.getByText('John Doe'));
    expect(onSelectCall).toHaveBeenCalledWith(mockCalls[0]);
  });

  it('renders loading state', () => {
    render(<CallHistoryTable calls={[]} isLoading={true} onSelectCall={() => {}} />);
    expect(screen.getByText('Loading calls...')).toBeInTheDocument();
  });
});

describe('CallDetailsPanel', () => {
  it('renders nothing when call is null', () => {
    const { container } = render(<CallDetailsPanel call={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders call details', () => {
    render(<CallDetailsPanel call={mockCalls[0]} onClose={() => {}} />);
    
    expect(screen.getByText('Call Details')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument(); // Caller
    expect(screen.getByText('Agent Smith')).toBeInTheDocument(); // Agent
    expect(screen.getByText('Hello world')).toBeInTheDocument(); // Transcript
  });
  
  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<CallDetailsPanel call={mockCalls[0]} onClose={onClose} />);
    
    // "Close Panel" button at the bottom
    fireEvent.click(screen.getByText('Close Panel'));
    expect(onClose).toHaveBeenCalled();
  });
});
