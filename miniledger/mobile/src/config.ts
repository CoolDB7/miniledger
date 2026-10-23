import { Platform } from "react-native";

// Set EXPO_PUBLIC_API_URL when testing on a real phone, e.g. http://192.168.1.10:4000
// Android emulator reaches your computer at 10.0.2.2; iOS simulator can use localhost.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000");
