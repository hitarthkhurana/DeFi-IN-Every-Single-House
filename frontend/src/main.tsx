import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LandingPage from './LandingPage'
import { BrowserRouter, Route, Routes } from 'react-router'
import "@/index.css";
import ChatInterface from './components/ChatInterface';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit/react'
import { projectId, metadata, networks, wagmiAdapter } from './config'

const queryClient = new QueryClient()

const generalConfig = {
  projectId,
  networks,
  metadata,
  themeMode: 'light' as const,
  themeVariables: {
    '--w3m-accent': '#000000',
  }
}

createAppKit({
  adapters: [wagmiAdapter],
  ...generalConfig,
  features: {
    analytics: true
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/chat" element={<ChatInterface />} />
      </Routes>
    </BrowserRouter>
    </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
)
