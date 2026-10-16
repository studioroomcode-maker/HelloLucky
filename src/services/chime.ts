import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | undefined;

/** A soft bell when a letter arrives: silent in silent mode, mixed over whatever the user is listening to. */
export async function playChime() {
  try {
    if (!player) {
      await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
      player = createAudioPlayer(require('@/assets/sounds/letter-chime.wav'));
    }
    await player.seekTo(0);
    player.play();
  } catch (error) {
    console.warn('chime: could not play', error); // a missing sound never blocks the letter
  }
}
