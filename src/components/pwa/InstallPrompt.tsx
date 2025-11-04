'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [hasBeenShown, setHasBeenShown] = useState(false);

  useEffect(() => {
    // Check if prompt has already been shown this session
    const promptShown = sessionStorage.getItem('pwa-install-prompt-shown');
    if (promptShown) {
      setHasBeenShown(true);
    }

    const handler = (e: BeforeInstallPromptEvent) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();

      // Stash the event so it can be triggered later
      setDeferredPrompt(e);

      // Show our custom install prompt if it hasn't been shown this session
      if (!hasBeenShown && !promptShown) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for the appinstalled event to handle successful installation
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      console.log('PWA was installed successfully');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [hasBeenShown]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Hide our custom prompt
    setShowInstallPrompt(false);

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);

    // Mark as shown this session
    sessionStorage.setItem('pwa-install-prompt-shown', 'true');
    setHasBeenShown(true);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Mark as shown this session so it doesn't appear again
    sessionStorage.setItem('pwa-install-prompt-shown', 'true');
    setHasBeenShown(true);
  };

  // Don't render if there's no deferred prompt or if we shouldn't show it
  if (!deferredPrompt || !showInstallPrompt) {
    return null;
  }

  return (
    <Dialog open={showInstallPrompt} onOpenChange={handleDismiss}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Install Dirt Free CRM
          </DialogTitle>
          <DialogDescription>
            Add this app to your home screen for quick access and offline functionality.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">Benefits of installing:</p>
            <ul className="space-y-1 ml-4">
              <li>• Quick access from your home screen</li>
              <li>• Works offline for reading tech weekly content</li>
              <li>• Faster loading and better performance</li>
              <li>• Native app-like experience</li>
            </ul>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Not now
            </Button>
            <Button
              onClick={handleInstallClick}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Install
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}