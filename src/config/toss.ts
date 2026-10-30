/**
 * The Apps in Toss (토스 미니앱) bundle: a web export built by toss/ with EXPO_PUBLIC_TOSS=1 (see TOSS.md).
 * Native builds never set it, so every `IS_TOSS` branch is dead code there.
 */
export const IS_TOSS = process.env.EXPO_PUBLIC_TOSS === '1';
