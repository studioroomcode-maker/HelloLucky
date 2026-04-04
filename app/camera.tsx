import { useRouter } from 'expo-router';

import { createExpoNavigation } from '../src/navigation/routerNavigation';
import CameraScreen from '../src/screens/CameraScreen';

export default function Camera() {
  const router = useRouter();
  const navigation = createExpoNavigation(router);

  return <CameraScreen navigation={navigation} />;
}
