import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rqyskkotselbleawzdia.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxeXNra290c2VsYmxlYXd6ZGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI5ODYsImV4cCI6MjA4NzA4ODk4Nn0.tkEhvIttououTR3bvqe2aV2VZ1Q2pfx237etL1ipB10';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type CloverSpot = {
  id: string;
  latitude: number;
  longitude: number;
  image_url: string;
  nickname?: string | null;
  message?: string | null;
  likes?: number | null;
  created_at: string;
};

export const saveCloverSpot = async ({
  latitude,
  longitude,
  imageUri,
  nickname = 'Anonymous Finder',
  message = '',
}: {
  latitude: number;
  longitude: number;
  imageUri: string;
  nickname?: string;
  message?: string;
}) => {
  // Upload first so the DB row can reference a public image URL.
  const filename = `clover_${Date.now()}.jpg`;
  const response = await fetch(imageUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('clovers')
    .upload(filename, blob, { contentType: 'image/jpeg' });

  if (uploadError) {
    throw uploadError;
  }

  const { data: urlData } = supabase.storage
    .from('clovers')
    .getPublicUrl(filename);

  const { error: dbError } = await supabase
    .from('clover_spots')
    .insert({
      latitude,
      longitude,
      image_url: urlData.publicUrl,
      nickname,
      message,
    });

  if (dbError) {
    throw dbError;
  }
};

export const getCloverSpots = async () => {
  const { data, error } = await supabase
    .from('clover_spots')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as CloverSpot[];
};
