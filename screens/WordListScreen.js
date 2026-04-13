import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Alert, Platform, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, ScrollView
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { BACKEND_URL } from '../config';

const FOLDER_COLORS = {
  blue:  { bg: "#e3f2fd", border: "#90caf9", text: "#1565c0" },
  green: { bg: "#e8f5e9", border: "#a5d6a7", text: "#2e7d32" },
  amber: { bg: "#fff8e1", border: "#ffe082", text: "#f57f17" },
};

export default function WordListScreen() {
  const [words,          setWords]          = useState([]);
  const [refreshing,     setRefreshing]     = useState(false);
  const [modalVisible,   setModalVisible]   = useState(false);
  const [folders,        setFolders]        = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [newWord,        setNewWord]        = useState({
    source_text: '', translated_text: '', phonetic: '', example: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const fetchWords = async () => {
    try {
      const res  = await fetch(`${BACKEND_URL}/words`);
      const data = await res.json();
      setWords(data);
    } catch (error) {
      console.error("Failed to fetch words:", error);
    }
  };

  const fetchFolders = async () => {
    try {
      const res  = await fetch(`${BACKEND_URL}/folders`);
      const data = await res.json();
      setFolders(data);
      if (data.length > 0 && !selectedFolder) {
        setSelectedFolder(data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    }
  };

  useEffect(() => { fetchWords(); }, []);

  // Refresh folders every time this tab is focused
  useFocusEffect(
    useCallback(() => { fetchFolders(); }, [])
  );

  const onRefreshing = async () => {
    setRefreshing(true);
    await fetchWords();
    setRefreshing(false);
  };

  // ── Sorting ──────────────────────────────────────────────
  const isJapanese = (text) => {
    if (!text) return false;
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  };

  const sortBy = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';

    const sorted = [...words].sort((a, b) => {
      let aValue, bValue;
      if (key === 'english') {
        aValue = isJapanese(a.source_text) ? a.translated_text : a.source_text;
        bValue = isJapanese(b.source_text) ? b.translated_text : b.source_text;
      } else if (key === 'japanese') {
        aValue = isJapanese(a.source_text) ? a.source_text : a.translated_text;
        bValue = isJapanese(b.source_text) ? b.source_text : b.translated_text;
      } else {
        aValue = a[key];
        bValue = b[key];
      }
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setWords(sorted);
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "⇅";
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const getSortLabel = () => {
    if (!sortConfig.key) return 'Original';
    const labels = { id: 'ID', english: 'English', japanese: 'Japanese', known: 'Known' };
    const direction = sortConfig.direction === 'asc' ? 'Up' : 'Down';
    return `${labels[sortConfig.key]} (${direction})`;
  };

  // ── Delete ────────────────────────────────────────────────
  const deleteCard = (id) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this card?')) deleteItem(id);
    } else {
      Alert.alert('Confirm', 'Do you want to delete this card?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', onPress: () => deleteItem(id), style: 'destructive' },
      ]);
    }
  };

  const deleteItem = (id) => {
    fetch(`${BACKEND_URL}/delete_word`, {
      method:  'POST',
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id }),
    })
      .then(res => res.json())
      .then(() => setWords(prev => prev.filter(w => w.id !== id)))
      .catch(() => Alert.alert('Error', 'Failed to delete'));
  };

  // ── Add word ──────────────────────────────────────────────
  const handleAddWord = async () => {
    if (!newWord.source_text.trim() || !newWord.translated_text.trim()) {
      Alert.alert("Error", "Original and translation are required");
      return;
    }
    if (!selectedFolder) {
      Alert.alert("Error", "Please select a folder");
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/save_word`, {
        method:  'POST',
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          source_text:     newWord.source_text,
          translated_text: newWord.translated_text,
          phonetic:        newWord.phonetic,
          example:         newWord.example,
          folder_id:       selectedFolder.id,     // NEW
        }),
      });

      const data = await response.json();
      if (data.status === "success") {
        Alert.alert("Saved!", `Word saved to "${selectedFolder.name}"`);
        setModalVisible(false);
        setNewWord({ source_text: '', translated_text: '', phonetic: '', example: '' });
        fetchWords();
      } else {
        Alert.alert('Error', 'Failed to save');
      }
    } catch (error) {
      console.error("Error saving:", error);
      Alert.alert("Error", "Failed to save");
    }
  };

  const handleOpenModal = () => {
    fetchFolders();       // always fresh when modal opens
    setModalVisible(true);
  };

  // ── Render ────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.headerRow}>
      <TouchableOpacity style={styles.headerCell} onPress={() => sortBy('id')}>
        <Text style={styles.headerText}>ID{getSortIcon('id')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerCell} onPress={() => sortBy('english')}>
        <Text style={styles.headerText}>English{getSortIcon('english')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerCell}>
        <Text style={styles.headerText}>Phonetic</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerCell} onPress={() => sortBy('japanese')}>
        <Text style={styles.headerText}>Japanese{getSortIcon('japanese')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerCell} onPress={() => sortBy('known')}>
        <Text style={styles.headerText}>Memorised{getSortIcon('known')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }) => {
    const isSourceJapanese = isJapanese(item.source_text);
    const englishText  = isSourceJapanese ? item.translated_text : item.source_text;
    const japaneseText = isSourceJapanese ? item.source_text     : item.translated_text;
    const phonetic     = item.phonetic || '';
    const example      = item.example  || '';
    const folderName   = item.folder_name || '';

    return (
      <TouchableOpacity
        onLongPress={() => deleteCard(item.id)}
        style={{ padding: 15, borderBottomWidth: 1, borderColor: '#ccc' }}
      >
        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.cellText}>{item.id}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellText}>{englishText}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellText}>{phonetic}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellText}>{japaneseText}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellText}>{item.known ? '✓' : '✗'}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cellText}>{example}</Text>
          </View>
          {/* Folder tag */}
          {folderName ? (
            <View style={styles.folderTag}>
              <Text style={styles.folderTagText}>{folderName}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: "#90c5dc" }}>
      {renderHeader()}
      <View style={styles.info}>
        <Text style={styles.infoText}>
          <Text style={styles.infoBold}>Current order: </Text>
          <Text>{getSortLabel()}</Text>
        </Text>
      </View>

      <FlatList
        data={words}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefreshing} />
        }
      />

      {/* + Button */}
      <TouchableOpacity style={styles.addButton} onPress={handleOpenModal}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>

      {/* Add word modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Modal header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Word</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Word fields */}
              <TextInput
                style={styles.input}
                placeholder="Original language"
                value={newWord.source_text}
                onChangeText={(text) => setNewWord({ ...newWord, source_text: text })}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Translation"
                value={newWord.translated_text}
                onChangeText={(text) => setNewWord({ ...newWord, translated_text: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Phonetic"
                value={newWord.phonetic}
                onChangeText={(text) => setNewWord({ ...newWord, phonetic: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Example"
                value={newWord.example}
                onChangeText={(text) => setNewWord({ ...newWord, example: text })}
              />

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
                            backgroundColor: isActive ? color.text : color.bg,
                            borderColor:     isActive ? color.text : color.border,
                          },
                        ]}
                        onPress={() => setSelectedFolder(folder)}
                        activeOpacity={0.75}
                      >
                        <Text style={[
                          styles.folderPillText,
                          { color: isActive ? "#fff" : color.text },
                        ]}>
                          {folder.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={styles.saveButton} onPress={handleAddWord}>
                <Text style={styles.saveButtonText}>
                  Save{selectedFolder ? ` to "${selectedFolder.name}"` : ''}
                </Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection:   'row',
    backgroundColor: '#1a7adb',
    borderRadius:    6,
    marginBottom:    12,
  },
  headerCell: { padding: 4, margin: 2, alignItems: 'stretch' },
  headerText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  info: {
    marginBottom:    8,
    padding:         12,
    backgroundColor: '#FFFFFF',
    borderRadius:    8,
  },
  infoText:  { fontSize: 12, color: '#374151' },
  infoBold:  { fontWeight: '600' },
  listContent: { paddingBottom: 80 },
  row:  { flexDirection: 'row', marginBottom: 4 },
  cell: { flex: 1, justifyContent: 'center', paddingHorizontal: 1 },
  cellText: { margin: 1, padding: 4, fontSize: 14, color: '#1F2937' },

  // Folder tag on word row
  folderTag: {
    alignSelf:       'center',
    backgroundColor: '#e3f2fd',
    borderRadius:    4,
    paddingHorizontal: 6,
    paddingVertical:   2,
    marginLeft:      4,
  },
  folderTagText: { fontSize: 10, color: '#1565c0', fontWeight: '600' },

  // Modal
  modalContainer: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor:     '#fff',
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    padding:             20,
    paddingBottom:       40,
    maxHeight:           '90%',
  },
  modalHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   20,
  },
  modalTitle:  { fontSize: 20, fontWeight: 'bold' },
  closeButton: { fontSize: 28, color: '#666' },
  input: {
    borderWidth:     1,
    borderColor:     '#ddd',
    borderRadius:    8,
    padding:         15,
    fontSize:        16,
    marginBottom:    15,
    backgroundColor: '#fff',
  },

  // Folder picker
  folderLabel: {
    fontSize:     14,
    fontWeight:   '600',
    color:        '#333',
    marginBottom: 10,
  },
  noFolders: {
    fontSize:     13,
    color:        '#888',
    fontStyle:    'italic',
    marginBottom: 16,
  },
  folderRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    marginBottom:  20,
  },
  folderPill: {
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      20,
    borderWidth:       1,
  },
  folderPillText: { fontSize: 13, fontWeight: '600' },

  // Save button
  saveButton: {
    backgroundColor: '#0a7ea4',
    padding:         15,
    borderRadius:    8,
    alignItems:      'center',
    marginTop:       10,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Add button
  addButton: {
    position:      'absolute',
    bottom:        30,
    right:         30,
    width:         54,
    height:        54,
    borderRadius:  32,
    backgroundColor: '#0a7ea4',
    justifyContent:  'center',
    alignItems:      'center',
    elevation:       5,
  },
  addButtonText: {
    color:      '#fff',
    fontSize:   38,
    fontWeight: 'bold',
    marginTop:  -2,
  },
});