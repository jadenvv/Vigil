import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import App from '@/App.jsx';
import { CLERK_PUBLISHABLE_KEY } from '@/lib/clerk';
import '@/index.css';

// Clerk wraps the app only when the workspace is configured; without a key the app is
// exactly as before (Base44 auth + anonymous demo), and /reviews explains instead of erroring.
ReactDOM.createRoot(document.getElementById('root')).render(
  CLERK_PUBLISHABLE_KEY ? (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  ) : (
    <App />
  ),
);
