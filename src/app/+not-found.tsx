import { Redirect } from 'expo-router';

// Any unknown URL (e.g. when hosted under a sub-path on web) lands on the app root.
export default function NotFound() {
  return <Redirect href="/" />;
}
