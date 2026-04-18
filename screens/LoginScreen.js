import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login }   = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (!result.success) {
      Alert.alert('Login failed', result.message || 'Invalid email or password');
    }
    // If success, App.js automatically switches to MainTabs
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>TranslaterApp</Text>
        <Text style={styles.subtitle}>Log in to your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Log in</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flexGrow: 1, justifyContent: 'center', padding: 28, backgroundColor: '#90c5dc' },
  title:      { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center', marginBottom: 6 },
  subtitle:   { fontSize: 15, color: '#444', textAlign: 'center', marginBottom: 32 },
  input:      { backgroundColor: '#fff', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 14, borderWidth: 1, borderColor: '#ddd' },
  btn:        { backgroundColor: '#0a7ea4', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkBtn:    { marginTop: 20, alignItems: 'center' },
  linkText:   { color: '#0a7ea4', fontSize: 14, fontWeight: '600' },
});