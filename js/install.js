// Hilfe zum Installieren auf dem Home-Bildschirm – für iPhone, Android und andere Handys.
let deferredPrompt = null;

export function initInstall(onChange) {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();          // eigener Knopf statt Browser-Leiste
    deferredPrompt = e;
    onChange();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; onChange(); });
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

export function installInfo() {
  const ua = navigator.userAgent;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const touch = matchMedia('(pointer: coarse)').matches;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const iosOtherBrowser = ios && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return { standalone, touch, ios, android, iosOtherBrowser, canPrompt: !!deferredPrompt };
}
