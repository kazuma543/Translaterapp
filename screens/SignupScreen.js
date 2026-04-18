import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function SignupScreen({ navigation }) {
  const { signup }  = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const result = await signup(email.trim(), password);
    setLoading(false);
    if (result.status === 'success') {
      Alert.alert(
        'Account created!',
        'Please check your email to confirm your account, then log in.',
        [{ text: 'Go to login', onPress: () => navigation.navigate('Login') }]
      );
    } else {
      Alert.alert('Signup failed', result.message || 'Please try again');
    }
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
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start learning vocabulary today</Text>

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
          placeholder="Password (6+ characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Sign up</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.linkText}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 28, backgroundColor: '#90c5dc' },
  title:     { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center', marginBottom: 6 },
  subtitle:  { fontSize: 15, color: '#444', textAlign: 'center', marginBottom: 32 },
  input:     { backgroundColor: '#fff', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 14, borderWidth: 1, borderColor: '#ddd' },
  btn:       { backgroundColor: '#0a7ea4', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkBtn:   { marginTop: 20, alignItems: 'center' },
  linkText:  { color: '#0a7ea4', fontSize: 14, fontWeight: '600' },
});