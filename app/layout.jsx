import './globals.css';
import { Inter } from 'next/font/google';
import { TelemetryProvider } from '@/app/components/telemetry/TelemetryProvider';
import { GlobalBugModal } from '@/app/components/telemetry/GlobalBugModal';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Prepnova Education - SAT Prep',
  description: 'High-performance SAT prep platform.',
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TelemetryProvider>
          <main className="min-h-screen bg-gray-50 flex flex-col">
            {children}
          </main>
          {/* <GlobalBugModal /> Held per user instruction to focus on columnar analytics */}
        </TelemetryProvider>
      </body>
    </html>
  );
}
