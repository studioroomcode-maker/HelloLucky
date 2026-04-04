import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { AppNavigation } from '../navigation/routerNavigation';
import { supabase, type CloverSpot } from '../services/supabase';

type Props = {
  route: {
    params: {
      spot: CloverSpot;
    };
  };
  navigation: Pick<AppNavigation, 'goBack'>;
};

export default function DetailScreen({ route, navigation }: Props) {
  const { spot } = route.params;
  const [likes, setLikes] = useState(spot.likes || 0);
  const [liked, setLiked] = useState(false);

  const handleLike = async () => {
    if (liked) {
      return;
    }

    const newLikes = likes + 1;
    setLikes(newLikes);
    setLiked(true);

    const { error } = await supabase
      .from('clover_spots')
      .update({ likes: newLikes })
      .eq('id', spot.id);

    if (error) {
      setLikes(likes);
      setLiked(false);
      Alert.alert('Like error', 'Could not save your like.');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <ScrollView style={styles.container} bounces={false}>
      <Image source={{ uri: spot.image_url }} style={styles.image} />

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>{'<'}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Four-leaf find</Text>
        </View>

        <Text style={styles.date}>{formatDate(spot.created_at)}</Text>
        <Text style={styles.nickname}>
          {(spot.nickname || 'Anonymous Finder')} saved this lucky spot
        </Text>

        {spot.message ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{`"${spot.message}"`}</Text>
          </View>
        ) : (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>
              For the next person passing by,{'\n'}may this place bring a little luck.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.likeBtn, liked && styles.likeBtnActive]}
          onPress={handleLike}
        >
          <Text style={styles.likeBtnText}>
            {liked ? 'Saved' : 'Like'} {likes}
          </Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          May this small bit of luck{'\n'}brighten the rest of your day.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  image: { width: '100%', height: 320 },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  content: {
    padding: 28,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: { color: '#2E7D32', fontSize: 13, fontWeight: 'bold' },
  date: { color: '#aaa', fontSize: 13, marginBottom: 8 },
  nickname: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  messageBox: {
    backgroundColor: '#F9FBE7',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 28,
  },
  messageText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 26,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  likeBtn: {
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 30,
    marginBottom: 32,
  },
  likeBtnActive: {
    backgroundColor: '#E8F5E9',
  },
  likeBtnText: { color: '#2E7D32', fontSize: 15, fontWeight: '600' },
  footer: {
    color: '#bbb',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 22,
  },
});
