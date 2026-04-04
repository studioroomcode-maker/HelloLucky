import { useRouter } from 'expo-router';

import { createExpoNavigation } from '../src/navigation/routerNavigation';
import MapScreen from '../src/screens/MapScreen';

export default function Index() {
  const router = useRouter();
  const navigation = createExpoNavigation(router);

  return <MapScreen navigation={navigation} />;
}
