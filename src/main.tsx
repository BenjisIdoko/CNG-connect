import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { startAnalytics } from './services/analytics';
import { installKeyboardInset } from './utils/keyboardInset';
import { AuthProvider } from './context/AuthContext';

installKeyboardInset();
startAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
