import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Button, StyleSheet,
  Alert, TouchableOpacity, ScrollView, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BACKEND_URL } from '../config';

const FOLDER_COLORS = {
  blue:  { bg: "#e3f2fd", border: "#90caf9", text: "#1565c0" },
  green: { bg: "#e8f5e9", border: "#a5d6a7", text: "#2e7d32" },
  amber: { bg: "#fff8e1", border: "#ffe082", text: "#f57f17" },
};

export default function TranslateScreen() {
  const [inputText,      setInputText]      = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [loading,        setLoading]        = useState(false);
  const [folders,        setFolders]        = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);

  // Fetch folders every time this tab is focused
  useFocusEffect(
    useCallback(() => {
      fetchWithAuth(`${BACKEND_URL}/folders`)
        .then((res) => res.json())
        .then((data) => {
          setFolders(data);
          // Auto-select first folder if nothing selected yet
          if (data.length > 0 && !selectedFolder) {
            setSelectedFolder(data[0]);
          }
        })
        .catch(() => console.error("Could not load folders"));
    }, [])
  );

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/translate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          text:        inputText,
          source_lang: "auto",
          target_lang: "auto",
        }),
      });
      const data = await response.json();
      setTranslatedText(data.translated_text || "");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Translation failed");
    }
    setLoading(false);
  };

  const handleSaveWord = async () => {
    if (!inputText.trim() || !translatedText.trim()) {
      Alert.alert("Error", "Please translate a word first");
      return;
    }
    if (!selectedFolder) {
      Alert.alert("Error", "Please select a folder to save to");
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/save_word`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          source_text:     inputText,
          translated_text: translatedText,
          source_lang:     'en',
          target_lang:     'ja',
          folder_id:       selectedFolder.id,   // NEW
        }),
      });

      const data = await response.json();
      if (data.status === "success") {
        Alert.alert("Saved!", `"${inputText}" saved to ${selectedFolder.name}`);
        setInputText('');
        setTranslatedText('');
      } else {
        Alert.alert("Error", "Failed to save the word");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Can't save!");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#90c5dc" }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Translator</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter text..."
        value={inputText}
        onChangeText={setInputText}
        multiline
      />

      <Button
        title={loading ? "Translating..." : "Translate"}
        onPress={handleTranslate}
        disabled={loading}
      />

      {translatedText ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Translation:</Text>
          <Text style={styles.resultText}>{translatedText}</Text>

          {/* Folder picker */}
          <Text style={styles.folderLabel}>Save to folder:</Text>
          {folders.length === 0 ? (
            <Text style={styles.noFolders}>
              No folders yet — create one in the FlashCard tab first.
            </Text>
          ) : (
            <View style={styles.folderRow}>
              {folders.map((folder) => {
                const color    = FOLDER_COLORS[folder.color] ?? FOLDER_COLORS.blue;
                const isActive = selectedFolder?.id === folder.id;
                return (
                  <TouchableOpacity
                    key={folder.id}
                    style={[
                      styles.folderPill,
                      {
                        backgroundColor: isActive ? color.text   : color.bg,
                        borderColor:     isActive ? color.text   : color.border,
                      },
                    ]}
                    onPress={() => setSelectedFolder(folder)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.folderPillText,
                        { color: isActive ? "#fff" : color.text },
                      ]}
                    >
                      {folder.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Button
            title={`Save to "${selectedFolder?.name ?? '...'}"`}
            onPress={handleSaveWord}
            disabled={!selectedFolder}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  input: {
    borderWidth:     1,
    borderColor:     "#ccc",
    backgroundColor: "rgba(255,255,255,0.5)",
    padding:         12,
    borderRadius:    8,
    minHeight:       100,
    fontSize:        15,
  },
  resultBox: {
    marginTop:       8,
    padding:         14,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius:    10,
    gap:             10,
  },
  resultTitle: {
    fontSize:   16,
    fontWeight: "600",
    color:      "#333",
  },
  resultText: {
    fontSize: 20,
    fontWeight: "bold",
    color:    "#1a1a1a",
  },
  folderLabel: {
    fontSize:  13,
    color:     "#555",
    marginTop: 4,
  },
  noFolders: {
    fontSize:  12,
    color:     "#888",
    fontStyle: "italic",
  },
  folderRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           8,
  },
  folderPill: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      20,
    borderWidth:       1,
  },
  folderPillText: {
    fontSize:   13,
    fontWeight: "600",
  },
});