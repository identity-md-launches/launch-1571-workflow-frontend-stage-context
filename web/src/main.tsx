import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import App from './App';
import { ConfigContext } from './hooks';
import { buildWagmiConfig, loadConfig } from './config';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

loadConfig()
  .then((cfg) => {
    const wagmi = buildWagmiConfig(cfg);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
    root.render(
      <StrictMode>
        <ConfigContext.Provider value={cfg}>
          <WagmiProvider config={wagmi}>
            <QueryClientProvider client={queryClient}>
              <App />
            </QueryClientProvider>
          </WagmiProvider>
        </ConfigContext.Provider>
      </StrictMode>,
    );
  })
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    root.render(
      <main className="boot-error">
        <h1>CAT WARS</h1>
        <p role="alert">The deployment configuration could not be loaded: {msg}</p>
        <p>This site reads its contract addresses and ABIs from imd-deployment.json next to this page. Reload, or check that the export is complete.</p>
      </main>,
    );
  });
