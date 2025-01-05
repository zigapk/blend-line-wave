import type { MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { MicrophoneProvider } from '~/lib/providers/microphone-provider';

export const meta: MetaFunction = () => {
  return [
    { title: 'New Remix App' },
    { name: 'description', content: 'Welcome to Remix!' },
  ];
};

export default function IndexLayout() {
  return (
    <MicrophoneProvider>
      <div className="h-dvh w-dvw">
        <Outlet />
      </div>
    </MicrophoneProvider>
  );
}
