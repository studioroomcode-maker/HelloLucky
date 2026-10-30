/**
 * A still photo from outside the live camera, for when it can't run. Native apps always have the live camera,
 * so only the web (Toss) bundle provides one: stillPhoto.web.ts.
 */
export type StillPhoto = {
  camera: string;
  album: string;
  take(how: 'camera' | 'album'): Promise<string | undefined>;
};

export const stillPhoto: StillPhoto | undefined = undefined;
