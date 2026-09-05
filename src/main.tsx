import { createRoot } from 'react-dom/client';
import { App, type AppServices } from './app/App';
import { selectE2EServices } from './app/e2eServices';
import './app/app.css';

declare global {
  interface Window {
    __ALIGNE_TEST_SERVICES__?: AppServices;
  }
}

const testServices = selectE2EServices(import.meta.env.MODE, window.__ALIGNE_TEST_SERVICES__);

createRoot(document.getElementById('root')!).render(testServices ? <App services={testServices} /> : <App />);
