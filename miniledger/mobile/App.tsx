import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "./src/auth";
import AddLoanScreen from "./src/screens/AddLoanScreen";
import HomeScreen from "./src/screens/HomeScreen";
import LoginScreen from "./src/screens/LoginScreen";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  AddLoan: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function Routes() {
  const { token, loading } = useAuth();
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <Stack.Navigator>
      {token ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "MiniLedger" }} />
          <Stack.Screen name="AddLoan" component={AddLoanScreen} options={{ title: "Add entry" }} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Routes />
        <StatusBar style="auto" />
      </NavigationContainer>
    </AuthProvider>
  );
}
