import { useLocalSearchParams, useRouter } from 'expo-router';

import { createExpoNavigation } from '../src/navigation/routerNavigation';
import DetailScreen from '../src/screens/DetailScreen';

export default function Detail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spot?: string | string[] }>();
  const navigation = createExpoNavigation(router);
  const rawSpot = Array.isArray(params.spot) ? params.spot[0] : params.spot;

  if (!rawSpot) {
    return null;
  }

  const spot = JSON.parse(rawSpot);

  return (
    <DetailScreen
      route={{ params: { spot } }}
      navigation={navigation}
    />
  );
}
