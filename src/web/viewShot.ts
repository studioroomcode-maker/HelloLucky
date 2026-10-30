/**
 * Web stand-in for react-native-view-shot (metro.config.js aliases it on web only). Its own web build goes through
 * findNodeHandle, which react-native-web 0.21 no longer has; a View's ref is the DOM element itself here.
 * html2canvas is view-shot's own dependency. Returns a data: URI (callers' file:// prefix is stripped by share.ts).
 */
import html2canvas from 'html2canvas';
import type { RefObject } from 'react';

type Options = { format?: 'png' | 'jpg' | 'webm'; quality?: number; width?: number; height?: number; result?: string };

export async function captureRef(view: RefObject<unknown> | unknown, options: Options = {}) {
  const node = (view && typeof view === 'object' && 'current' in view ? view.current : view) as HTMLElement | null;
  if (!node) throw new Error('view-shot: nothing to capture');
  let canvas = await html2canvas(node, { backgroundColor: null, scale: window.devicePixelRatio || 1 });
  if (options.width) {
    const resized = Object.assign(document.createElement('canvas'), {
      width: options.width,
      height: options.height ?? Math.round((canvas.height * options.width) / canvas.width),
    });
    resized.getContext('2d')!.drawImage(canvas, 0, 0, resized.width, resized.height);
    canvas = resized;
  }
  return canvas.toDataURL(options.format === 'jpg' ? 'image/jpeg' : 'image/png', options.quality ?? 1);
}
