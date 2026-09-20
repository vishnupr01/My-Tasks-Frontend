import Sidebar from '@/components/Sidebar';
import ToastContainer from '@/components/ToastContainer';
import { SettingsProvider } from '@/lib/settings-context';
import { ToastProvider } from '@/lib/toast-context';
import { PresenceProvider } from '@/lib/presence-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider>
        <PresenceProvider>
          {/*
            fixed + inset-0 (not h-screen/h-dvh/h-svh, and not a
            window.visualViewport-measuring effect either) pins the whole
            app shell directly to the browser's actual visual viewport --
            the one thing every vh-family unit ends up guessing at instead
            of measuring. A `position: fixed` box's size and position are
            defined by the browser against the visual viewport natively,
            continuously, with no JS involved -- so there's no reflow race
            against anything else that runs on mount (e.g. a chat page's
            scroll-to-bottom-on-load), which is what a live-measured
            (window.visualViewport height-in-state) approach couldn't avoid:
            if the address bar's show/hide animation settles a moment after
            that measurement effect's first read, the resulting resize
            update lands after the scroll-to-bottom already happened,
            leaving things visually out of sync until a manual scroll
            resynced them.

            overflow-hidden keeps this box from growing past that pinned
            size -- the sidebar and content pane each manage their own
            internal scrolling below, rather than the browser window
            scrolling and taking the sidebar out of view with it.

            flex-col below md: Sidebar's mobile top bar sits in normal flow
            above the content (its actual nav drawer is fixed/off-canvas, so
            it doesn't take up row space). flex-row at md: and up, back to
            the sidebar as a static column beside the content, top bar gone.
          */}
          <div className="fixed inset-0 flex flex-col md:flex-row bg-black overflow-hidden">
            <Sidebar />
            <div className="flex-1 min-w-0 h-full overflow-y-auto">{children}</div>
          </div>
          <ToastContainer />
        </PresenceProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
