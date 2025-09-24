import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';

// Import screens
import DashboardScreen from './react-native-web-app/src/screens/DashboardScreen';
import POSScreen from './react-native-web-app/src/screens/POSScreen';
import InventoryScreen from './react-native-web-app/src/screens/InventoryScreen';
import CustomersScreen from './react-native-web-app/src/screens/CustomersScreen';
import ReportsScreen from './react-native-web-app/src/screens/ReportsScreen';
import SettingsScreen from './react-native-web-app/src/screens/SettingsScreen';
import AdminDashboardScreen from './react-native-web-app/src/screens/AdminDashboardScreen';
import UserManagementScreen from './react-native-web-app/src/screens/UserManagementScreen';
import AdminReportsScreen from './react-native-web-app/src/screens/AdminReportsScreen';

// Import custom drawer
import CustomDrawerContent from './src/components/CustomDrawerContent';

const Drawer = createDrawerNavigator();

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Drawer.Navigator
          drawerContent={(props) => <CustomDrawerContent {...props} />}
          screenOptions={{
            headerStyle: { backgroundColor: '#2563eb' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            drawerActiveTintColor: '#2563eb',
            drawerInactiveTintColor: '#6b7280',
          }}
        >
          <Drawer.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{
              drawerIcon: ({ color, size }) => (
                <FontAwesome name="line-chart" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="POS"
            component={POSScreen}
            options={{
              drawerIcon: ({ color, size }) => (
                <FontAwesome name="credit-card" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="Inventory"
            component={InventoryScreen}
            options={{
              drawerIcon: ({ color, size }) => (
                <FontAwesome name="archive" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="Customers"
            component={CustomersScreen}
            options={{
              drawerIcon: ({ color, size }) => (
                <FontAwesome name="users" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="Reports"
            component={ReportsScreen}
            options={{
              drawerIcon: ({ color, size }) => (
                <FontAwesome name="bar-chart" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              drawerIcon: ({ color, size }) => (
                // <FontAwesome name="cog" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="Admin Dashboard"
            component={AdminDashboardScreen}
            options={{
              drawerIcon: ({ color, size }) => (
                <FontAwesome name="dashboard" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="User Management"
            component={UserManagementScreen}
            options={{
              drawerIcon: ({ color, size }) => (
                <FontAwesome name="user" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="Admin Reports"
            component={AdminReportsScreen}
            options={{
              drawerIcon: ({ color, size }) => (
                <FontAwesome name="line-chart" size={size} color={color} />
              ),
            }}
          />
        </Drawer.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
