import { requireOptionalNativeModule } from 'expo';

/** One picture drawn into a video frame, in output pixels; `fit` scales it into its box like CSS object-fit. */
export type VideoLayer = {
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fit?: 'cover' | 'contain';
  /** Used in this frame only (a map snapshot), so it isn't kept in memory. */
  once?: boolean;
};

type JourneyVideoModule = {
  /** Opens an H.264 MP4 at `path` (file path, no scheme); `width`/`height` should be multiples of 16. */
  start(path: string, width: number, height: number, fps: number): Promise<void>;
  /** Draws `layers` over `background` (#RRGGBB) and adds the picture `repeat` times. */
  addFrame(layers: VideoLayer[], background: string, repeat: number): Promise<void>;
  /** Finishes the file; resolves with its path. With `audio` (a file path or URI) that track plays under it, faded out at the end. */
  finish(audio?: string | null): Promise<string>;
  /** Drops an unfinished video. */
  cancel(): Promise<void>;
};

/** Frame-by-frame MP4 writer (Android and iOS; undefined in Expo Go). */
export const JourneyVideo = requireOptionalNativeModule<JourneyVideoModule>('JourneyVideo');
