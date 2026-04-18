import React from 'react';
import { View, ActivityIndicator } from 'react-native';
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

const Tab       = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const FlashStack = createNativeStackNavigator();

// FlashCard stack (folder list → study mode)
function FlashCardStack() {
  return (
    <FlashStack.Navigator screenOptions={{ headerShown: false }}>
      <FlashStack.Screen name="FlashCardHome"  component={FlashCardScreen} />
      <FlashStack.Screen name="FlashCardStudy" component={FlashCardStudy} />
    </FlashStack.Navigator>
  );
}

// Main app tabs — only shown when logged in
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle:          { backgroundColor: '#fff' },
        headerTintColor:      '#0c0b0b',
        tabBarStyle:          { backgroundColor: '#121212' },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#aaa',
      }}
    >
      <Tab.Screen name="Translate" component={TranslateScreen} />
      <Tab.Screen name="WordList"  component={WordListScreen} />
      <Tab.Screen name="FlashCard" component={FlashCardStack} />
    </Tab.Navigator>
  );
}

// Auth screens — only shown when logged out
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login"  component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

// Root — switches between auth and main based on login state
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