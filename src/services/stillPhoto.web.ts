/**
 * Web (Toss bundle) still photo, for when the live camera (getUserMedia) is missing or refused: the Toss camera or
 * album through toss/src/toss-bridge.js, or a file picker in a plain browser. Returns an upright blob: URI for
 * app/wide.tsx, undefined when the user backs out, and throws with a message to show when it can't.
 */
import { lang } from '../i18n';
import { dataUriToBlob, uprightPhotoUri } from '../web/photo';
import type { StillPhoto } from './stillPhoto';

type TossPhoto = { dataUri?: string; canceled?: boolean; denied?: boolean; unsupported?: boolean; error?: boolean };
declare global {
  interface Window {
    hlToss?: { photo(how: 'camera' | 'album'): Promise<TossPhoto>; openURL(url: string): Promise<unknown> };
  }
}

// Toss users read Korean; English for anyone else (these few lines live outside src/i18n's 16 languages).
const ko = lang === 'ko';
const TEXT = {
  camera: ko ? '사진 찍어서 찾기' : 'Find in a photo',
  album: ko ? '앨범에서 사진 고르기' : 'Pick a photo',
  denied: ko ? '사진을 쓰려면 권한이 필요해요. 토스 설정에서 허용해 주세요.' : 'Allow photo access in Toss settings to use photos.',
  failed: ko ? '사진을 가져오지 못했어요. 다시 시도해 주세요.' : "Couldn't get the photo. Please try again.",
};

function pickFile(capture: boolean) {
  return new Promise<File | undefined>((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = () => resolve(input.files?.[0]);
    input.oncancel = () => resolve(undefined);
    input.click();
  });
}

async function take(how: 'camera' | 'album') {
  if (!window.hlToss) {
    const file = await pickFile(how === 'camera');
    return file && uprightPhotoUri(file);
  }
  const result = await window.hlToss.photo(how);
  if (result.dataUri) return uprightPhotoUri(dataUriToBlob(result.dataUri));
  if (result.canceled) return undefined;
  throw new Error(result.denied ? TEXT.denied : TEXT.failed);
}

export const stillPhoto: StillPhoto = { camera: TEXT.camera, album: TEXT.album, take };
