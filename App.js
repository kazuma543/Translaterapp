import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TranslateScreen from './screens/TranslateScreen';
import WordListScreen from './screens/WordListScreen';
import FlashCardScreen from './screens/FlashCardScreen';
import { StyleSheet } from 'react-native';




const Tab = createBottomTabNavigator();
export default function App() {
  return (

    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Tab.Navigator
            screenOptions={{
            headerStyle:{ backgroundColor:"#fff"},
            headerTintColor: "#0c0b0bff",
            tabBarStyle: {backgroundColor: "#121212"},
            tabBarActiveTintColor: "#4CAF50",
            tabBarIactiveTintColor:"#aaa",
            sceneContinerStyle:{ backgroundColor: "#121212"}
            
            }}
        >
          <Tab.Screen 
          name="Translate" 
          component={TranslateScreen}
          options={{ title: 'Translate' }}
         />
          <Tab.Screen 
          name="WordList" 
          component={WordListScreen}
          options={{ title: 'WordList' }}
          />
          <Tab.Screen
          name="FlashCard"
          component={FlashCardScreen}
          option={{ title: 'FlashCard'}}
          />
        </Tab.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>

  );
}

