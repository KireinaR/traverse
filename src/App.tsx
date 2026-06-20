import { Suspense, lazy } from 'react';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import TopBar from './components/UI/TopBar';
import BottomBar from './components/UI/BottomBar';
import InfoPanel from './components/UI/InfoPanel';
import PrivacyModal from './components/UI/PrivacyModal';
import './styles.css';

const MapView = lazy(() => import('./components/Map/MapView'));

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <div className="app-root">
          <Suspense fallback={<div className="map-fallback">Loading map…</div>}>
            <MapView />
          </Suspense>
          <TopBar />
          <BottomBar />
          <InfoPanel />
          <PrivacyModal />
        </div>
      </AppProvider>
    </ThemeProvider>
  );
}
