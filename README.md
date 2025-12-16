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
│   ├── client.ts       # Axios instance with interceptors
│   └── hooks.ts        # TanStack Query hooks for API calls
├── components/         # Reusable UI components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   ├── Sidebar.tsx
│   ├── TopBar.tsx
│   ├── ProtectedRoute.tsx
│   ├── DashboardLayout.tsx
│   ├── ToastProvider.tsx
│   └── index.ts
├── pages/              # Page components
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Users.tsx
│   ├── Analytics.tsx
│   ├── Settings.tsx
│   └── index.ts
├── router/
│   └── index.tsx       # Route definitions
├── store/
│   └── authStore.ts    # Zustand auth store
├── test/               # Test files
│   ├── setup.ts
│   ├── authStore.test.ts
│   ├── ProtectedRoute.test.tsx
│   ├── Layout.test.tsx
│   ├── Button.test.tsx
│   ├── Input.test.tsx
│   └── LoginFlow.test.tsx
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
2. Enters username and password
3. Credentials are sent to backend API (`POST /api/auth/login`)
4. Backend returns JWT token and user data
5. Token is stored securely in HTTP-only cookies
6. User is redirected to dashboard
7. All subsequent API requests include the token in Authorization header
8. On 401 response, user is automatically logged out and redirected to login

## API Integration

The application uses a flexible API client setup:

```typescript
// Using the API hooks
const { mutate: login, isPending } = useLogin();

login(
  { username, password },
  {
    onSuccess: (data) => {
      // Handle successful login
    },
    onError: (error) => {
      // Handle error
    },
  }
);
```

### Expected Backend API Endpoints

```
POST   /api/auth/login          # Login endpoint
POST   /api/auth/logout         # Logout endpoint
GET    /api/users               # Get users list
GET    /api/user/:id            # Get user details
```

## Demo Credentials

For testing purposes, the login form displays demo credentials:
- **Username**: demo
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

Run tests:
```bash
npm test                 # Run all tests
npm test -- --watch     # Watch mode
npm run test:ui         # Interactive UI
```

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
