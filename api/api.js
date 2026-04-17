import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKEND_URL } from "../config";

// 共通fetch（token付き）
export const fetchWithAuth = async (endpoint, options = {}) => {
  const token = await AsyncStorage.getItem("token");

  return fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
};