import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';

import type { AppNavigation } from '../navigation/routerNavigation';
import { getCloverSpots, type CloverSpot } from '../services/supabase';

type Props = {
  navigation: AppNavigation;
};

export default function MapScreen({ navigation }: Props) {
  const [spots, setSpots] = useState<CloverSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadSpots = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const data = await getCloverSpots();
      setSpots(data);
    } catch (error) {
      console.error(error);
      setLoadError('Could not load the map. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSpots();
    }, [loadSpots]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hello Lucky</Text>
        <Text style={styles.subtitle}>
          {spots.length > 0
            ? `${spots.length} saved four-leaf finds so far.`
            : 'No saved four-leaf finds yet.'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading the luck map...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadSpots}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: 37.5665,
            longitude: 126.978,
            latitudeDelta: 5,
            longitudeDelta: 5,
          }}
          showsUserLocation
        >
          {spots.map((spot) => (
            <Marker
              key={spot.id}
              coordinate={{
                latitude: spot.latitude,
                longitude: spot.longitude,
              }}
              onPress={() =>
                navigation.navigate('detail', { spot: JSON.stringify(spot) })
              }
            >
              <View style={styles.marker}>
                <Text style={styles.markerEmoji}>4L</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      <TouchableOpacity
        style={styles.findBtn}
        onPress={() => navigation.navigate('camera')}
      >
        <Text style={styles.findBtnText}>Open camera</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  map: { flex: 1 },
  marker: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerEmoji: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 14,
  },
  errorText: {
    color: '#5C4632',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  retryBtn: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryBtnText: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  findBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  findBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
