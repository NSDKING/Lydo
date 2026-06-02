import { Redirect } from 'expo-router';

// expo-share-intent opens the app at /share when a URL is shared.
// We redirect immediately to the Recipes tab where ShareIntentProvider
// picks up hasShareIntent and triggers the import flow.
export default function ShareIntentRoute() {
  return <Redirect href="/(tabs)/recipes" />;
}
