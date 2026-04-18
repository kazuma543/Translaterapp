import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { BACKEND_URL } from '../config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token,   setToken]   = useState(null);
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);  // true while checking stored token

  // On app launch, restore token from secure storage
  useEffect(() => {
    const restore = async () => {
      try {
        const stored = await SecureStore.getItemAsync('auth_token');
        const email  = await SecureStore.getItemAsync('auth_user');
        if (stored) {
          setToken(stored);
          setUser(email);
        }
      } catch (e) {
        console.error('Failed to restore token:', e);
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const login = async (email, password) => {
    const res  = await fetch(`${BACKEND_URL}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.status === 'success') {
      await SecureStore.setItemAsync('auth_token', data.token);
      await SecureStore.setItemAsync('auth_user',  data.user);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    }
    return { success: false, message: data.message };
  };

  const signup = async (email, password) => {
    const res  = await fetch(`${BACKEND_URL}/signup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return data;
  };

  const logout = async () => {
    try {
      await fetch(`${BACKEND_URL}/logout`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('auth_user');
      setToken(null);
      setUser(null);
    }
  };

  // authFetch — use this everywhere instead of plain fetch()
  const authFetch = (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type':  'application/json',
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, signup, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);