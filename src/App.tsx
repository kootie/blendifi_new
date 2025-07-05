import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import { ToastProvider, useToast } from './context/ToastContext';
import Swap from './components/Swap';
import Supply from './components/Supply';
import Borrow from './components/Borrow';
import Stake from './components/Stake';
import Portfolio from './components/Portfolio';
import WalletConnect from './components/WalletConnect';
import { ToastContainer } from './components/Toast';

function Navbar() {
  const location = useLocation();
  return (
    <nav className="flex items-center justify-between py-4 px-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-6">
        <span className="font-bold text-xl text-blue-700">Blendifi</span>
        <Link to="/" className={location.pathname === '/' ? 'font-semibold text-blue-600' : 'text-zinc-700 dark:text-zinc-200'}>Home</Link>
        <Link to="/swap" className={location.pathname === '/swap' ? 'font-semibold text-blue-600' : 'text-zinc-700 dark:text-zinc-200'}>Swap</Link>
        <Link to="/supply" className={location.pathname === '/supply' ? 'font-semibold text-blue-600' : 'text-zinc-700 dark:text-zinc-200'}>Supply</Link>
        <Link to="/borrow" className={location.pathname === '/borrow' ? 'font-semibold text-blue-600' : 'text-zinc-700 dark:text-zinc-200'}>Borrow</Link>
        <Link to="/stake" className={location.pathname === '/stake' ? 'font-semibold text-blue-600' : 'text-zinc-700 dark:text-zinc-200'}>Stake</Link>
        <Link to="/portfolio" className={location.pathname === '/portfolio' ? 'font-semibold text-blue-600' : 'text-zinc-700 dark:text-zinc-200'}>Portfolio</Link>
      </div>
      <div className="flex flex-col items-end gap-2">
        <WalletConnect />
      </div>
    </nav>
  );
}

function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          Welcome to <span className="text-blue-600">Blendifi</span>
        </h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8 max-w-3xl mx-auto">
          Your comprehensive DeFi hub on the Stellar network. Swap, supply, borrow, and stake with ease.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/swap" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            Start Trading
          </Link>
          <Link to="/portfolio" className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors">
            View Portfolio
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Swap</h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            Trade between XLM, BLND, USDC, wETH, and wBTC with competitive rates and minimal slippage.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Supply</h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            Provide liquidity to earn yield on your assets while supporting the ecosystem.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Borrow</h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            Access liquidity by borrowing against your supplied assets with competitive interest rates.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Stake</h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            Stake your tokens to earn rewards and participate in governance decisions.
          </p>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-8 rounded-lg mb-8">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">About Blendifi</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Built on Stellar</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              Blendifi leverages the Stellar blockchain's fast, secure, and cost-effective infrastructure. 
              With sub-second finality and minimal transaction fees, you can trade and manage your DeFi 
              positions efficiently.
            </p>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>• Lightning-fast transactions (3-5 seconds)</li>
              <li>• Ultra-low fees (~0.00001 XLM per operation)</li>
              <li>• Built-in DEX for seamless trading</li>
              <li>• Native multi-currency support</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Smart Contract Powered</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              Our platform is powered by Soroban smart contracts deployed on the Stellar network. 
              This ensures transparency, security, and programmability for all DeFi operations.
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded text-xs font-mono text-zinc-700 dark:text-zinc-300">
              Contract: CA26SDP73CGMH5E5HHTHT3DN4YPH4DJUNRBRHPB4ZJTF2DQXDMCXXTZH
            </div>
          </div>
        </div>
      </div>

      {/* Supported Tokens */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Supported Tokens</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { symbol: 'XLM', name: 'Stellar Lumens', color: 'bg-blue-100 dark:bg-blue-900' },
            { symbol: 'BLND', name: 'Blendifi Token', color: 'bg-green-100 dark:bg-green-900' },
            { symbol: 'USDC', name: 'USD Coin', color: 'bg-purple-100 dark:bg-purple-900' },
            { symbol: 'wETH', name: 'Wrapped Ethereum', color: 'bg-orange-100 dark:bg-orange-900' },
            { symbol: 'wBTC', name: 'Wrapped Bitcoin', color: 'bg-yellow-100 dark:bg-yellow-900' }
          ].map((token) => (
            <div key={token.symbol} className={`${token.color} p-4 rounded-lg text-center`}>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{token.symbol}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">{token.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center bg-zinc-50 dark:bg-zinc-800 p-8 rounded-lg">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Ready to Start?</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Connect your Freighter wallet and begin your DeFi journey on Stellar.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/swap" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            Start Trading
          </Link>
          <Link to="/supply" className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors">
            Supply Assets
          </Link>
          <Link to="/borrow" className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors">
            Borrow Funds
          </Link>
        </div>
      </div>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500">
      <span className="text-2xl font-bold mb-2">{title}</span>
      <span className="text-sm">Coming soon...</span>
    </div>
  );
}

function AppContent() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="max-w-6xl mx-auto py-8 px-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/swap" element={<Swap />} />
          <Route path="/supply" element={<Supply />} />
          <Route path="/borrow" element={<Borrow />} />
          <Route path="/stake" element={<Stake />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="*" element={<Placeholder title="Page Not Found" />} />
        </Routes>
      </main>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </WalletProvider>
  );
} 