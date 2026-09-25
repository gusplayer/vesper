import { Redirect } from 'expo-router';

/**
 * Any path the app does not have — an old `vesper://` link, a typo in a notification's
 * URL — lands on Focus instead of the router's own "Unmatched Route" page, which is
 * neither designed nor translated. Before the onboarding is done, the root guard turns
 * Focus into the onboarding by itself.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
