/**
 * Moving to a new phone: one backup file with the journal (finds, notes, badges, counters), every photo and the
 * anonymous account's tokens, shared through the system share sheet and picked back up on the new phone.
 */
import { Directory, File, Paths } from 'expo-file-system';
import Share from 'react-native-share';

import { asciiBytes, asciiJson, backupMagic, bytesText, entryHeader, readEntries } from '../backupFormat';
import { journalSnapshot, replaceJournal } from './findsStore';
import { exportSession, importSession } from './sharing';

const PHOTO = /^finds\/[\w-]+\.jpg$/;

export async function exportBackup() {
  const journal = journalSnapshot();
  const session = await exportSession().catch(() => undefined);
  const file = new File(Paths.cache, `HelloLuck-${new Date().toISOString().slice(0, 10)}.hlbackup`);
  if (file.exists) file.delete();
  file.create();
  const out = file.open();
  try {
    const put = (name: string, bytes: Uint8Array) => {
      out.writeBytes(entryHeader(name, bytes.length));
      out.writeBytes(bytes);
    };
    out.writeBytes(backupMagic());
    put('data.json', asciiBytes(asciiJson(journal)));
    if (session) put('auth.json', asciiBytes(asciiJson(session)));
    for (const uri of journal.finds.flatMap((find) => (find.cloverUri ? [find.photoUri, find.cloverUri] : [find.photoUri]))) {
      const photo = new File(uri);
      if (photo.exists) put(`finds/${uri.split('/').pop()}`, await photo.bytes());
    }
  } finally {
    out.close();
  }
  await Share.open({ url: file.uri, type: 'application/octet-stream', failOnCancel: false });
}

/**
 * Replaces everything on this phone with a picked backup. Finds and photos always come back; letters and
 * journeys come back only if the account can still sign in ('noLetters' otherwise, e.g. offline).
 */
export async function restoreBackup(): Promise<'restored' | 'noLetters' | 'cancelled'> {
  const picked = await File.pickFileAsync().catch(() => undefined);
  const file = Array.isArray(picked) ? picked[0] : picked;
  if (!file) return 'cancelled';

  // Photos go to a staging folder first, so a broken backup leaves the current journal untouched.
  const staged = new Directory(Paths.cache, 'restore-photos');
  if (staged.exists) staged.delete();
  staged.create();
  let raw: string | undefined;
  let session: { access_token: string; refresh_token: string } | undefined;
  const input = file.open();
  try {
    const read = (length: number) => input.readBytes(Math.min(length, (input.size ?? 0) - (input.offset ?? 0)));
    for (const { name, data } of readEntries(read)) {
      if (name === 'data.json') raw = bytesText(data);
      else if (name === 'auth.json') session = JSON.parse(bytesText(data));
      else if (PHOTO.test(name)) new File(staged, name.slice('finds/'.length)).write(data);
    }
  } finally {
    input.close();
  }
  if (!raw) throw new Error('backup: no journal in the file');
  await replaceJournal(raw, staged.uri);
  if (!session?.refresh_token) return 'restored';
  return importSession(session).then(
    () => 'restored' as const,
    () => 'noLetters' as const,
  );
}
