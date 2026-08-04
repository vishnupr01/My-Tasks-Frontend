import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'TaskFlow',
  description: 'Personal task manager',
};

// Runs before hydration so a saved non-default theme applies on first paint,
// instead of flashing the hacker theme for a frame then switching.
const themeInitScript = `
  try {
    var t = localStorage.getItem('task_manager_theme');
    if (t === 'normal' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-mono bg-black min-h-screen text-green-400">{children}</body>
    </html>
  );
}
