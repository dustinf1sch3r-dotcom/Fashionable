import * as ImagePicker from 'expo-image-picker';
import type { PickedPhoto } from './bodyPhotoPipeline';

export type PickOutcome =
  | { kind: 'picked'; photo: PickedPhoto }
  | { kind: 'cancelled' }
  | { kind: 'denied' }
  | { kind: 'error' };

/** Take or choose one photo, with the camera permission handled (same as the add-item flow). */
export async function pickBodyPhoto(source: 'camera' | 'library'): Promise<PickOutcome> {
  try {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { kind: 'denied' };
    }
    const options = { mediaTypes: ['images' as const], quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return { kind: 'cancelled' };
    const [asset] = result.assets;
    return { kind: 'picked', photo: { uri: asset.uri, width: asset.width, height: asset.height } };
  } catch {
    return { kind: 'error' };
  }
}
