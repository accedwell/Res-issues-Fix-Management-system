import axios from 'axios';
import Constants from 'expo-constants';

// In development, use the same computer Expo is served from, so the
// backend is found even when the Wi-Fi IP changes.
function getBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:5000/api`;
}

export const api = axios.create({
  baseURL: getBaseUrl(),
});
