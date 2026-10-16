# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One brand design on both iOS and Android (confirmed 2026-10-16); only system behaviors (back navigation, share sheet, permission dialogs, haptics) follow each OS.

## Users

Everyone, of any age, worldwide (confirmed). The typical moment: on a walk, in a park or along a path, crouching over a clover patch with the phone held 30–50 cm above it, often in bright daylight, sometimes with friends or kids. Sessions are short and playful; the camera screen is used one-handed outdoors.

## Product Purpose

Hello Luck turns four-leaf-clover hunting into a small daily ritual of finding and sharing luck. An on-device AI highlights likely four-leaf clovers in the live camera; each find becomes a keepsake (photo, place, note, a fortune line) that grows a luck pot and unlocks badges. Luck is meant to be passed on: to friends as a photo card with an invite link, to strangers as a random lucky letter, and to everyone as a pin on the world Lucky Map. Success = people go outside, find one, and send it on.

## Positioning

The only clover app whose AI runs fully on the phone (no video leaves the device) and whose social layer is about giving luck away, not followers or feeds: anonymous lucky letters to strangers, photo-free location pins, no accounts.

## Operating Context

- Outdoors, glare, moving camera; the scan screen must stay legible over grass.
- First-run onboarding → home (pot, badges, journal grid) → scan → find detail (fortune, note, send luck, pin to map) → Lucky Map, badges, mailbox popups, settings.
- 14 UI languages (ko, en, ja, zh-Hans, zh-Hant, es, fr, de, pt, it, ru, id, vi, th); text lengths vary a lot (German, Russian, Thai).

## Capabilities and Constraints

- Expo SDK 54 / React Native 0.81, new architecture, expo-router; react-native-vision-camera + TFLite (YOLOv8n, 960 input); react-native-maps (Google); Supabase (anonymous auth) for map pins and lucky letters; Expo push.
- Journal stays on device (JSON + photos). Only map pins (coords, city/area name, date) and lucky letters (curated message index, card index, city) reach the server.
- No free text or photos ever go to strangers. 100 badges (50 hidden), 50 fortune lines, 6 pot stages, 8 luck-card designs.
- Light mode is the default; dark and system modes are user options.

## Brand Commitments

- Name: "Hello Luck" (internal id com.studioroomkr.HelloLucky). Copy says "luck" (행운) instead of "four-leaf clover".
- User-supplied assets are binding: `assets/icon.png` (green rounded-square icon, clover in white scan brackets), `assets/logo.png` (white chunky rounded "HELLO LUCK" wordmark with a small clover), `assets/title.png` (sky-blue + clover-meadow title art with the logo and "나의 행운을 찾아서").
- Voice: warm, playful, cute, short; emoji welcome.
- Font: SD Gothic Neo Round (owner-licensed; Regular body, Medium emphasis, ExtraBold display).
- The user wants the UI to feel handmade and cute, explicitly not AI-generated.

## Evidence on Hand

Real assets above; on-device model metrics (valid mAP50 0.934). No testimonials, user counts or press exist; do not invent any.

## Product Principles

1. Outside first: every screen should make going out to look for luck feel easy and worth it.
2. Luck is for giving: sending luck is as prominent as finding it.
3. Private by default: nothing personal leaves the phone unless the user explicitly sends or pins it.
4. Small joys over metrics: celebrate finds, badges and letters with charm, never with pressure or streak guilt.

## Accessibility & Inclusion

All ages: large tap targets, readable type over photos and grass, labels for screen readers, reduced-motion respected for celebratory animation.
