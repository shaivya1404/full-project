# React + TypeScript Dashboard

A modern, fully-featured React + TypeScript dashboard application with authentication, routing, and a reusable component library.

## Features

- ✅ **Authentication System**
  - JWT-based login with secure token storage
  - Protected routes and role-based access control
  - Automatic token refresh on 401 responses
  - Persistent authentication via secure cookies

- ✅ **Modern Tech Stack**
  - React 19 + TypeScript
  - Vite for fast development and optimized builds
  - Tailwind CSS for styling
  - TanStack Query for data fetching and caching
  - Axios with global error handling
  - Zustand for state management
  - React Router v7 for navigation

- ✅ **Design System & UI Components**
  - Reusable Button component (primary, secondary, ghost, danger variants)
  - Input component with validation and error display
  - Card component for consistent layout
  - Notification system with react-hot-toast
  - Icon library with Lucide React

- ✅ **Application Shell**
  - Responsive sidebar navigation
  - Top bar with user profile menu
  - Real-time call indicators (placeholders)
  - Notification center with visual indicators
  - Dark mode ready

- ✅ **Pages & Routes**
  - Login page with form validation
  - Dashboard with stats and metrics
  - Users management page (template)
  - Analytics page (template)
  - Settings page with user preferences

- ✅ **Developer Experience**
  - Global API client with interceptors
  - Comprehensive test suite (Vitest + React Testing Library)
  - ESLint configuration
  - TypeScript strict mode enabled
  - Hot Module Replacement (HMR)

## Project Structure

```
src/
├── api/
│   ├── client.ts           # Axios instance with interceptors
│   ├── calls.ts            # TanStack Query hooks for calls
│   └── hooks.ts            # TanStack Query hooks (auth, users, etc.)
├── services/
│   └── api.ts              # Direct API service functions (optional)
├── components/
│   ├── Button.tsx          # Button component with variants
│   ├── Input.tsx           # Form input component
│   ├── Card.tsx            # Container component
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── TopBar.tsx          # Header with user menu
│   ├── ProtectedRoute.tsx  # Auth-protected route wrapper
│   ├── DashboardLayout.tsx # Layout wrapper
│   ├── ToastProvider.tsx   # Toast notifications provider
│   ├── dashboard/          # Dashboard-specific components
│   │   ├── CallHistoryTable.tsx    # Calls table
│   │   ├── CallDetailsPanel.tsx    # Call details sidebar
│   │   ├── AudioPlayer.tsx         # Audio player
│   │   ├── AnalyticsCards.tsx      # Stats cards
│   │   ├── AnalyticsChart.tsx      # Chart visualization
│   │   ├── RealTimeWidget.tsx      # Real-time status
│   │   └── index.ts
│   └── index.ts
├── pages/
│   ├── Login.tsx           # Login page
│   ├── Dashboard.tsx       # Main dashboard with calls
│   ├── Analytics.tsx       # Analytics dashboard
│   ├── Users.tsx           # User management
│   ├── Settings.tsx        # Settings page
│   └── index.ts
├── router/
│   └── index.tsx           # Route definitions
├── store/
│   └── authStore.ts        # Zustand auth store
├── types/
│   └── index.ts            # TypeScript type definitions
├── test/
│   ├── setup.ts
│   ├── authStore.test.ts
│   ├── ProtectedRoute.test.tsx
│   ├── Layout.test.tsx
│   ├── Button.test.tsx
│   ├── Input.test.tsx
│   ├── LoginFlow.test.tsx
│   └── CallOps.test.tsx
├── App.tsx
├── main.tsx
└── index.css
```

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests with UI
npm run test:ui
```

## Authentication Flow

1. User navigates to `/login`
2. Enters email and password
3. Credentials are sent to backend API (`POST /api/auth/login`)
4. Backend returns JWT token and user data
5. Token is stored securely in HTTP-only cookies
6. User is redirected to dashboard
7. All subsequent API requests include the token in Authorization header
8. On 401 response, user is automatically logged out and redirected to login

## API Integration

The application uses a comprehensive API client with TanStack Query for data management:

### API Client Architecture

**Files:**
- `src/api/client.ts` - Axios instance with request/response interceptors
- `src/api/hooks.ts` - TanStack Query hooks for all API operations
- `src/services/api.ts` - Service functions for direct API calls

### Authentication

Using TanStack Query hooks:
```typescript
const { mutate: login, isPending } = useLogin();

login(
  { email, password },
  {
    onSuccess: (data) => {
      toast.success('Login successful!');
      navigate('/dashboard');
    },
    onError: (error) => {
      toast.error(error.message || 'Login failed');
    },
  }
);
```

### Call History & Details

```typescript
// Get paginated call history with filters
const { data: callsData, isLoading } = useCalls({
  page: 1,
  limit: 10,
  search: 'search term',
  status: 'completed',
  sentiment: 'positive'
});

// Get specific call details
const { data: call, isLoading } = useCall('call-id-123');

// Download recording
await downloadRecording('call-id-123');

// Add notes to call
const { mutate: addNotes } = useAddNotes();
addNotes({ callId: 'call-id-123', notes: 'Customer complaint about service' });

// Search calls
const { data: results } = useSearchCalls('search query');
```

### Analytics

```typescript
// Get call statistics and trends
const { data: stats, isLoading } = useCallStats();
// Returns: totalCalls, avgDuration, sentimentScore, activeCalls, callVolumeHistory

// Get detailed analytics
const { data: analytics } = useQuery({
  queryKey: ['analytics/summary'],
  queryFn: async () => {
    const response = await client.get('/analytics/summary');
    return response.data;
  }
});
```

### Backend API Endpoints

**Authentication:**
```
POST   /api/auth/login          # { email, password } -> { user, token }
POST   /api/auth/logout         # No body required
```

**Calls:**
```
GET    /api/calls               # Query params: page, limit, search, status, sentiment
GET    /api/calls/:callId       # Get specific call details
GET    /api/calls/:callId/recording  # Download call recording (returns blob)
GET    /api/calls/search?q=...  # Search calls by query
POST   /api/calls/:callId/notes # { notes: string } - Add notes to call
```

**Analytics:**
```
GET    /api/analytics/summary   # Get overall analytics
GET    /api/analytics/calls     # Get call statistics
```

**Users:**
```
GET    /api/users               # Get all users
GET    /api/users/:id           # Get specific user details
```

## Demo Credentials

For testing purposes, the login form displays demo credentials:
- **Email**: demo@example.com
- **Password**: demo123

These should be updated or removed in production.

## Styling

The application uses Tailwind CSS with a custom design system:

### Color Palette
- Primary: `#6366f1` (Indigo)
- Secondary: `#8b5cf6` (Violet)

### Available Button Variants
- `primary` - Main call-to-action buttons
- `secondary` - Alternative actions
- `ghost` - Subtle interactions
- `danger` - Destructive actions

### Component Classes
- `.btn-primary` - Primary button styling
- `.btn-secondary` - Secondary button styling
- `.btn-ghost` - Ghost button styling
- `.input-base` - Base input field styling

## Testing

The project includes comprehensive tests for:

- ✅ Authentication store (login, logout, state management)
- ✅ Protected routes (redirect unauthorized users)
- ✅ Layout components (sidebar, top bar, dashboard)
- ✅ UI components (Button, Input)
- ✅ Login flow (form validation, submission)
- ✅ Call operations (call history, details, analytics)

### Running Tests

```bash
npm test                 # Run all tests once
npm test -- --watch     # Watch mode for development
npm run test:ui         # Interactive UI for test exploration
```

### Test Checklist for API Integration

To verify the API integration is working correctly:

1. **Authentication**
   - [ ] Login with demo credentials (demo@example.com / demo123)
   - [ ] Token is stored in cookies
   - [ ] User is redirected to dashboard
   - [ ] Logout clears token and redirects to login
   - [ ] Accessing protected routes without auth redirects to login

2. **Call History**
   - [ ] Dashboard loads call history from API
   - [ ] Pagination controls work (prev/next buttons)
   - [ ] Search functionality filters calls
   - [ ] Status filter (active/completed/missed) works
   - [ ] Sentiment filter (positive/neutral/negative) works
   - [ ] Clicking a call row opens the details panel

3. **Call Details**
   - [ ] Call metadata displays correctly (caller, agent, duration, etc.)
   - [ ] Full transcript displays with proper formatting
   - [ ] Audio player loads and plays recording
   - [ ] Download button downloads the recording file
   - [ ] Notes section allows adding new notes
   - [ ] Notes are saved to the backend

4. **Analytics**
   - [ ] Key metrics display (Total Calls, Avg Duration, Sentiment Score, Active Calls)
   - [ ] Call volume chart renders historical data
   - [ ] Sentiment distribution shows percentages
   - [ ] Call trends section displays peak hours and growth

5. **Error Handling**
   - [ ] Network errors display user-friendly error messages
   - [ ] 404 errors for missing calls are handled gracefully
   - [ ] Unauthorized (401) responses trigger automatic logout
   - [ ] Toast notifications appear for success/error actions

6. **Loading States**
   - [ ] Loading spinners display while fetching data
   - [ ] Skeleton loaders show in tables during load
   - [ ] Disabled states on buttons during API calls

## Environment Variables

Create a `.env.local` file in the root directory (for Vite):

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## Development Tips

### Adding New Pages

1. Create a new component in `src/pages/`
2. Add a route in `src/router/index.tsx`
3. Add navigation link in `src/components/Sidebar.tsx`

### Adding New API Endpoints

1. Add a new hook in `src/api/hooks.ts` using `useMutation` or `useQuery`
2. Use the hooks in your components
3. The global error handler in `client.ts` will automatically handle 401s

### Creating New Components

1. Create component in `src/components/`
2. Export from `src/components/index.ts`
3. Use consistent styling with Tailwind classes
4. Add TypeScript interfaces for props

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Considerations

- Automatic query caching (5 minutes stale time)
- Code splitting via React Router
- Lazy loading support ready
- Optimized bundle size with Vite

## Security Features

- JWT stored in secure HTTP-only cookies
- CSRF protection ready
- Authorization header automatically added to all requests
- Automatic logout on 401 responses
- Input validation on forms

## Deployment

### Build for Production
```bash
npm run build
```

The `dist/` directory contains the optimized production build.

### Environment Setup for Production
Update your `.env` with production API URL:
```env
REACT_APP_API_BASE_URL=https://api.example.com
```

## Contributing

This is a template-based project. Feel free to:
- Modify components and styling
- Add new pages and features
- Extend the API client
- Add more comprehensive tests

## License

MIT

## Future Enhancements

- [ ] Implement real WebSocket connection for real-time indicators
- [ ] Add dark mode toggle
- [ ] Implement two-factor authentication
- [ ] Add role-based access control (RBAC)
- [ ] Create mobile-responsive improvements
- [ ] Add data export functionality
- [ ] Implement advanced filtering and search
- [ ] Add audit logging
