import Dashboard from '@/components/Dashboard';
import portfolio from '@/data/transactions.json';
import type { PortfolioData } from '@/lib/types';

export default function Home() {
  return <Dashboard data={portfolio as PortfolioData} />;
}
