import { Redirect } from 'expo-router';

// expo-share-intent opens the app with lydo://dataUrl=<key>#<type>
// expo-router can't match that path, so it lands here.
// Redirect to the Recipes tab where ShareIntentProvider processes the intent.
export default function NotFound() {
  return <Redirect href="/(tabs)/recipes" />;
}
