import { createRoot } from 'react-dom/client';
import { App, type AppServices } from './app/App';
import './app/app.css';

declare global {
  interface Window {
    __ALIGNE_TEST_SERVICES__?: AppServices;
  }
}

const testServices = window.__ALIGNE_TEST_SERVICES__;

createRoot(document.getElementById('root')!).render(testServices ? <App services={testServices} /> : <App />);
