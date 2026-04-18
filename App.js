import React from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { NavigationContainer }     from '@react-navigation/native';
import { GestureHandlerRootView }  from 'react-native-gesture-handler';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthProvider, useAuth } from './context/AuthContext';

import TranslateScreen  from './screens/TranslateScreen';
import WordListScreen   from './screens/WordListScreen';
import FlashCardScreen  from './screens/FlashCardScreen';
import FlashCardStudy   from './screens/FlashCardStudy';
import LoginScreen      from './screens/LoginScreen';
import SignupScreen     from './screens/SignupScreen';

const Tab        = createBottomTabNavigator();
const AuthStack  = createNativeStackNavigator();
const FlashStack = createNativeStackNavigator();

function FlashCardStack() {
  return (
    <FlashStack.Navigator screenOptions={{ headerShown: false }}>
      <FlashStack.Screen name="FlashCardHome"  component={FlashCardScreen} />
      <FlashStack.Screen name="FlashCardStudy" component={FlashCardStudy} />
    </FlashStack.Navigator>
  );
}

// ── ログアウトボタン ──────────────────────────────────────
function LogoutButton() {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      `Log out from ${user}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: logout,   // AuthContextのlogoutを呼ぶだけ
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={handleLogout}
      style={{ marginRight: 16 }}
    >
      <Text style={{ color: '#e53935', fontSize: 14, fontWeight: '600' }}>
        Log out
      </Text>
    </TouchableOpacity>
  );
}

// ── メインタブ ────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle:             { backgroundColor: '#fff' },
        headerTintColor:         '#0c0b0b',
        headerRight:             () => <LogoutButton />,  // 全タブのヘッダー右上に表示
        tabBarStyle:             { backgroundColor: '#121212' },
        tabBarActiveTintColor:   '#4CAF50',
        tabBarInactiveTintColor: '#aaa',
      }}
    >
      <Tab.Screen name="Translate" component={TranslateScreen} />
      <Tab.Screen name="WordList"  component={WordListScreen} />
      <Tab.Screen name="FlashCard" component={FlashCardStack} />
    </Tab.Navigator>
  );
}

// ── 認証スタック ──────────────────────────────────────────
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login"  component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

// ── ルート（ログイン状態で分岐） ──────────────────────────
function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#90c5dc' }}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  return token ? <MainTabs /> : <AuthNavigator />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}