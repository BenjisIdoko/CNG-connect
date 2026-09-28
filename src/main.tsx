import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { startAnalytics } from './services/analytics';
import { installKeyboardInset } from './utils/keyboardInset';
import { installStaleChunkReload } from './utils/staleChunkReload';
import { applyThemePref, getThemePref } from './utils/theme';
import { AuthProvider } from './context/AuthContext';

installStaleChunkReload();
// index.html already does this inline (before first paint); repeating it here is a safety
// net for a service-worker-cached shell from before that script existed.
applyThemePref(getThemePref());
installKeyboardInset();
startAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
