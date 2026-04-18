import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { BACKEND_URL } from "../config";
// 他のインポートの下に追加
import { useAuth } from '../context/AuthContext';

const FOLDER_COLORS = {
  blue:  { bg: "#e3f2fd", icon: "#bbdefb", text: "#1565c0" },
  green: { bg: "#e8f5e9", icon: "#c8e6c9", text: "#2e7d32" },
  amber: { bg: "#fff8e1", icon: "#ffe082", text: "#f57f17" },
};

export default function FlashCardScreen({ navigation }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { authFetch } = useAuth();

  const fetchFolders = async () => {
    try {
      const res  = await authFetch(`${BACKEND_URL}/folders`);
      const data = await res.json();
      setFolders(data);
    } catch (e) {
      Alert.alert("Error", "Could not load folders.");
    } finally {
      setLoading(false);
    }
  };

  // Refresh every time the tab is focused
  useFocusEffect(useCallback(() => { fetchFolders(); }, []));

  const handleCreateFolder = () => {
    Alert.prompt(
      "New Folder",
      "Enter a folder name:",
      async (name) => {
        if (!name?.trim()) return;
        await authFetch(`${BACKEND_URL}/create_folder`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name: name.trim(), color: "blue" }),
        });
        fetchFolders();
      }
    );
  };

  const handleDeleteFolder = (folder) => {
    Alert.alert(
      "Delete Folder",
      `Delete "${folder.name}"? Words inside will not be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            await authFetch(`${BACKEND_URL}/delete_folder`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ id: folder.id }),
            });
            fetchFolders();
          },
        },
      ]
    );
  };

  const renderFolder = ({ item }) => {
    const color = FOLDER_COLORS[item.color] ?? FOLDER_COLORS.blue;
    return (
      <TouchableOpacity
        style={[styles.folderCard, { backgroundColor: color.bg }]}
        onPress={() => navigation.navigate("FlashCardStudy", { folder: item })}
        onLongPress={() => handleDeleteFolder(item)}
        activeOpacity={0.75}
      >
        <View style={[styles.folderIcon, { backgroundColor: color.icon }]} />
        <View style={styles.folderInfo}>
          <Text style={[styles.folderName, { color: color.text }]}>{item.name}</Text>
          <Text style={styles.folderCount}>{item.word_count} words</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a folder</Text>

      <FlatList
        data={folders}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderFolder}
        contentContainerStyle={{ gap: 10 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No folders yet. Create one below!</Text>
        }
      />

      <TouchableOpacity style={styles.newFolderBtn} onPress={handleCreateFolder}>
        <Text style={styles.newFolderText}>+ New Folder</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#90c5dc", padding: 20, paddingTop: 30 },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#90c5dc" },
  title:        { fontSize: 22, fontWeight: "bold", color: "#1a1a1a", marginBottom: 16 },
  folderCard:   { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 14, gap: 12 },
  folderIcon:   { width: 36, height: 28, borderRadius: 4 },
  folderInfo:   { flex: 1 },
  folderName:   { fontSize: 16, fontWeight: "600" },
  folderCount:  { fontSize: 12, color: "#666", marginTop: 2 },
  arrow:        { fontSize: 20, color: "#aaa" },
  empty:        { textAlign: "center", color: "#555", marginTop: 40 },
  newFolderBtn: {
    marginTop: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#2196f3",
    borderStyle: "dashed",
    padding: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  newFolderText: { color: "#2196f3", fontSize: 15, fontWeight: "600" },
});