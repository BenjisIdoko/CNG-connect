import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { AuthProvider } from './context/AuthContext';
import { StationProvider } from './context/StationContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <StationProvider>
        <App />
      </StationProvider>
    </AuthProvider>
  </StrictMode>,
);
