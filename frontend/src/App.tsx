import { FC, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Scale, LayoutDashboard, Menu, X, Sun, Moon, Monitor } from 'lucide-react';
import { Button } from './components/Button';
import { EntryPage } from './pages/EntryPage';
import { DashboardPage } from './pages/DashboardPage';

const navigation = [
  { name: 'Entry', to: '/', icon: Scale },
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
];

const App: FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    return saved || 'system';
  });

  // Apply theme globally
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const cycleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  const getThemeIcon = () => {
    if (theme === 'light') return <Sun className="w-4 h-4" />;
    if (theme === 'dark') return <Moon className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const getThemeLabel = () => {
    if (theme === 'light') return 'Light';
    if (theme === 'dark') return 'Dark';
    return 'System';
  };

  return (
    <BrowserRouter basename="/dharam-kaanta">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-300',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'will-change-transform'
        )}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
              <h1 className="text-xl font-bold">⚖️ Dharam Kaanta</h1>
              <button 
                className="lg:hidden p-2 text-gray-300 hover:text-white"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {navigation.map((item) => (
                <RouteLink key={item.name} to={item.to} icon={item.icon}>
                  {item.name}
                </RouteLink>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-700">
              <div className="mb-3">
                <label className="block text-xs text-gray-400 mb-1">Theme</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 flex-1 text-center">{getThemeLabel()}</span>
                  <Button variant="ghost" size="sm" onClick={cycleTheme} className="flex-1">
                    {getThemeIcon()}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center">v1.0.0</p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:ml-64 min-h-screen w-full lg:w-auto">
          {/* Mobile menu button */}
          <button 
            className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <Routes>
            <Route path="/" element={<EntryPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

interface RouteLinkProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

const RouteLink: FC<RouteLinkProps> = ({ to, icon: Icon, children }) => {
  return (
    <Link
      to={to}
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white',
        'hover:bg-gray-800 transition-colors font-medium'
      )}
    >
      <Icon className="w-5 h-5" />
      {children}
    </Link>
  );
};

export default App;