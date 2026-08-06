import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './stile/global.css';

const wurzel = document.getElementById('root');
if (!wurzel) throw new Error('Das Element mit der Kennung "root" fehlt in index.html.');

createRoot(wurzel).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
