import { createNativeStackNavigator } from "@react-navigation/native-stack";
import FlashCardScreen  from "./screens/FlashCardScreen";
import FlashCardStudy   from "./screens/FlashCardStudy";
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TranslateScreen from './screens/TranslateScreen';
import WordListScreen from './screens/WordListScreen';
import { StyleSheet } from 'react-native';


const FlashStack = createNativeStackNavigator();

function FlashCardStack() {
  return (
    <FlashStack.Navigator screenOptions={{ headerShown: false }}>
      <FlashStack.Screen name="FlashCardHome"  component={FlashCardScreen} />
      <FlashStack.Screen name="FlashCardStudy" component={FlashCardStudy} />
    </FlashStack.Navigator>
  );
}



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
          component={FlashCardStack}
          />
        </Tab.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>

  );
}

