import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Avatar, Divider } from 'react-native-paper';
import {
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';

const CustomDrawerContent = (props: any) => {
  return (
    <View style={styles.container}>
      {/* User Profile Section */}
      <View style={styles.profileSection}>
        <Avatar.Text 
          size={60} 
          label="DR" 
          style={styles.profileAvatar}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>Dr. John Smith</Text>
          <Text style={styles.profileRole}>Medical Director</Text>
          <Text style={styles.profileEmail}>john.smith@clinic.com</Text>
        </View>
      </View>

      <Divider style={styles.divider} />

      {/* Drawer Items */}
      <DrawerContentScrollView {...props}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <Divider style={styles.divider} />

      {/* Footer Section */}
      <View style={styles.footerSection}>
        <TouchableOpacity style={styles.footerItem}>
          <Text style={styles.footerIcon}>⚙️</Text>
          <Text style={styles.footerText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerItem}>
          <Text style={styles.footerIcon}>❓</Text>
          <Text style={styles.footerText}>Help & Support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerItem}>
          <Text style={styles.footerIcon}>ℹ️</Text>
          <Text style={styles.footerText}>About</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  profileSection: {
    padding: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  profileAvatar: {
    backgroundColor: '#2563eb',
    marginBottom: 15,
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  profileRole: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 3,
  },
  profileEmail: {
    fontSize: 12,
    color: '#9ca3af',
  },
  divider: {
    backgroundColor: '#e5e7eb',
    height: 1,
  },
  footerSection: {
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  footerIcon: {
    fontSize: 18,
    marginRight: 15,
    width: 20,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutIcon: {
    fontSize: 18,
    marginRight: 15,
    width: 20,
    textAlign: 'center',
  },
  logoutText: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '600',
  },
});

export default CustomDrawerContent;
