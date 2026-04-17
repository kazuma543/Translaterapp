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
  const [sortConfig,  setSortConfig]  = useState({ key: null, direction: null });
  const [activeWord,  setActiveWord]  = useState(null);
  const [editMode,    setEditMode]    = useState(false);
  const [editedWord,  setEditedWord]  = useState(null);   // draft while editing
  const [editFolder,  setEditFolder]  = useState(null);   // folder selected in edit mode

  // ── Fetch ─────────────────────────────────────────────────
const fetchWords = useCallback(async () => {
  try {
    const res  = await fetchWithAuth(`${BACKEND_URL}/words`);
    const data = await res.json();
    setWords(data);
  } catch (e) {
    console.error("Failed to fetch words:", e);
  }
}, []);

const fetchFolders = useCallback(async () => {
  try {
    const res  = await etchWithAuth(`${BACKEND_URL}/folders`);
    const data = await res.json();
    setFolders(data);
    if (data.length > 0 && !selectedFolder) setSelectedFolder(data[0]);
  } catch (e) {
    console.error("Failed to fetch folders:", e);
  }
}, [selectedFolder]);
useFocusEffect(
  useCallback(() => {
    fetchWords();
    fetchFolders();
  }, [fetchWords, fetchFolders])
);

  const onRefreshing = async () => {
    setRefreshing(true);
    await fetchWords();
    setRefreshing(false);
  };

  // ── Helpers ───────────────────────────────────────────────
  const isJapanese = (text) => {
    if (!text) return false;
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  };

  const englishOf  = (item) => isJapanese(item?.source_text) ? item?.translated_text : item?.source_text;
  const japaneseOf = (item) => isJapanese(item?.source_text) ? item?.source_text     : item?.translated_text;

  // ── Open detail modal ─────────────────────────────────────
  const openDetail = (item) => {
    setActiveWord(item);
    setEditMode(false);
    setEditedWord({ ...item });
    // pre-select current folder in edit picker
    const current = folders.find(f => f.id === item.folder_id) ?? null;
    setEditFolder(current);
  };

  const closeDetail = () => {
    setActiveWord(null);
    setEditMode(false);
    setEditedWord(null);
    setEditFolder(null);
  };

  // ── Save edit ─────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editedWord.source_text?.trim() || !editedWord.translated_text?.trim()) {
      Alert.alert("Error", "Original and translation are required");
      return;
    }

    try {
      // 1. Update word content
      const res = await etchWithAuth(`${BACKEND_URL}/update_word`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          id:             editedWord.id,
          source_text:    editedWord.source_text,
          translated_text:editedWord.translated_text,
          phonetic:       editedWord.phonetic,
          example:        editedWord.example,
        }),
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error("Update failed");

      // 2. Move to new folder if changed
      if (editFolder?.id !== activeWord.folder_id) {
        await fetch(`${BACKEND_URL}/move_word`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ word_id: editedWord.id, folder_id: editFolder?.id ?? null }),
        });
      }

      Alert.alert("Saved!", "Word updated successfully");
      closeDetail();
      fetchWords();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to update word");
    }
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
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
      .then(res => res.json())
      .then(() => {
        setWords(prev => prev.filter(w => w.id !== id));
        closeDetail();
      })
      .catch(() => Alert.alert('Error', 'Failed to delete'));
  };

  // ── Add new word ──────────────────────────────────────────
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
      const response = await fetchWithAuth(`${BACKEND_URL}/save_word`, {
        method:  'POST',
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...newWord, folder_id: selectedFolder.id }),
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
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save");
    }
  };

  // ── Sort ──────────────────────────────────────────────────
  const sortBy = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    const sorted = [...words].sort((a, b) => {
      let aVal, bVal;
      if (key === 'english')  { aVal = englishOf(a);  bVal = englishOf(b); }
      else if (key === 'japanese') { aVal = japaneseOf(a); bVal = japaneseOf(b); }
      else { aVal = a[key]; bVal = b[key]; }
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setWords(sorted);
    setSortConfig({ key, direction });
  };

  const getSortIcon  = (key) => sortConfig.key !== key ? "⇅" : sortConfig.direction === 'asc' ? '↑' : '↓';
  const getSortLabel = () => {
    if (!sortConfig.key) return 'Original';
    const labels = { id: 'ID', english: 'English', japanese: 'Japanese', known: 'Known' };
    return `${labels[sortConfig.key]} (${sortConfig.direction === 'asc' ? 'Up' : 'Down'})`;
  };

  // ── Render list ───────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.headerRow}>
      {[['id','ID'],['english','English'],['phonetic','Phonetic'],['japanese','Japanese'],['known','Memorised']].map(([key, label]) => (
        <TouchableOpacity key={key} style={styles.headerCell} onPress={() => sortBy(key)}>
          <Text style={styles.headerText}>{label}{getSortIcon(key)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => openDetail(item)}
      onLongPress={() => deleteCard(item.id)}
      style={styles.listItem}
    >
      <View style={styles.row}>
        <View style={styles.cell}><Text style={styles.cellText}>{item.id}</Text></View>
        <View style={styles.cell}><Text style={styles.cellText}>{englishOf(item)}</Text></View>
        <View style={styles.cell}><Text style={styles.cellText}>{item.phonetic || ''}</Text></View>
        <View style={styles.cell}><Text style={styles.cellText}>{japaneseOf(item)}</Text></View>
        <View style={styles.cell}><Text style={styles.cellText}>{Number(item.known) === 1 ? '✓' : '✗'}</Text></View>
      </View>
      {item.folder_name ? (
        <View style={styles.folderTagWrap}>
          <View style={styles.folderTag}>
            <Text style={styles.folderTagText}>{item.folder_name}</Text>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  // ── Folder pill used in both modals ───────────────────────
  const FolderPills = ({ selected, onSelect }) => (
    <View style={styles.folderRow}>
      {folders.map((folder) => {
        const color    = FOLDER_COLORS[folder.color] ?? FOLDER_COLORS.blue;
        const isActive = selected?.id === folder.id;
        return (
          <TouchableOpacity
            key={folder.id}
            style={[styles.folderPill, {
              backgroundColor: isActive ? color.text : color.bg,
              borderColor:     isActive ? color.text : color.border,
            }]}
            onPress={() => onSelect(folder)}
          >
            <Text style={[styles.folderPillText, { color: isActive ? "#fff" : color.text }]}>
              {folder.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Main render ───────────────────────────────────────────
  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: "#90c5dc" }}>
      {renderHeader()}
      <View style={styles.info}>
        <Text style={styles.infoText}>
          <Text style={styles.infoBold}>Current order: </Text>
          {getSortLabel()}
        </Text>
      </View>

      <FlatList
        data={words}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshing} />}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => { fetchFolders(); setModalVisible(true); }}
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>

      {/* ── Detail / Edit Modal ── */}
      <Modal
        transparent={true}
        visible={!!activeWord}
        animationType="fade"
        onRequestClose={closeDetail}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { if (!editMode) closeDetail(); }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.detailCard}>
            <ScrollView showsVerticalScrollIndicator={false}>

              {editMode ? (
                /* ── EDIT MODE ── */
                <>
                  <Text style={styles.editSectionTitle}>Edit Word</Text>

                  <Text style={styles.editLabel}>Original</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editedWord?.source_text}
                    onChangeText={(t) => setEditedWord({ ...editedWord, source_text: t })}
                    autoCapitalize="none"
                  />

                  <Text style={styles.editLabel}>Translation</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editedWord?.translated_text}
                    onChangeText={(t) => setEditedWord({ ...editedWord, translated_text: t })}
                  />

                  <Text style={styles.editLabel}>Phonetic</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editedWord?.phonetic}
                    onChangeText={(t) => setEditedWord({ ...editedWord, phonetic: t })}
                  />

                  <Text style={styles.editLabel}>Example</Text>
                  <TextInput
                    style={[styles.editInput, { minHeight: 60 }]}
                    value={editedWord?.example}
                    onChangeText={(t) => setEditedWord({ ...editedWord, example: t })}
                    multiline
                  />

                  <Text style={styles.editLabel}>Folder</Text>
                  <FolderPills selected={editFolder} onSelect={setEditFolder} />

                  <View style={styles.editBtnRow}>
                    <TouchableOpacity
                      style={[styles.editActionBtn, styles.cancelBtn]}
                      onPress={() => setEditMode(false)}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editActionBtn, styles.saveEditBtn]}
                      onPress={handleSaveEdit}
                    >
                      <Text style={styles.saveEditBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                /* ── VIEW MODE ── */
                <>
                  <Text style={styles.detailEnglish}>{englishOf(activeWord)}</Text>

                  {activeWord?.phonetic ? (
                    <Text style={styles.detailPhonetic}>{activeWord.phonetic}</Text>
                  ) : null}

                  <Text style={styles.detailJapanese}>{japaneseOf(activeWord)}</Text>

                  {activeWord?.example ? (
                    <View style={styles.exampleBox}>
                      <Text style={styles.exampleText}>{activeWord.example}</Text>
                    </View>
                  ) : null}

                  {activeWord?.folder_name ? (
                    <View style={styles.folderBox}>
                      <Text style={styles.tagButtonText}>{activeWord.folder_name}</Text>
                    </View>
                  ) : null}

                  {/* Action buttons */}
                  <View style={styles.detailBtnRow}>
                    <TouchableOpacity
                      style={[styles.detailBtn, styles.editBtn]}
                      onPress={() => setEditMode(true)}
                    >
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.detailBtn, styles.deleteBtn]}
                      onPress={() => deleteCard(activeWord.id)}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.detailBtn, styles.closeBtn]}
                      onPress={closeDetail}
                    >
                      <Text style={styles.closeBtnText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Add Word Modal ── */}
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
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Word</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Original language"
                value={newWord.source_text}
                onChangeText={(t) => setNewWord({ ...newWord, source_text: t })}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Translation"
                value={newWord.translated_text}
                onChangeText={(t) => setNewWord({ ...newWord, translated_text: t })}
              />
              <TextInput
                style={styles.input}
                placeholder="Phonetic"
                value={newWord.phonetic}
                onChangeText={(t) => setNewWord({ ...newWord, phonetic: t })}
              />
              <TextInput
                style={styles.input}
                placeholder="Example"
                value={newWord.example}
                onChangeText={(t) => setNewWord({ ...newWord, example: t })}
              />

              <Text style={styles.folderLabel}>Save to folder:</Text>
              {folders.length === 0 ? (
                <Text style={styles.noFolders}>
                  No folders yet — create one in the FlashCard tab first.
                </Text>
              ) : (
                <FolderPills selected={selectedFolder} onSelect={setSelectedFolder} />
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
  headerRow:       { flexDirection: 'row', backgroundColor: '#1a7adb', borderRadius: 6, marginBottom: 12 },
  headerCell:      { padding: 4, margin: 2, alignItems: 'stretch' },
  headerText:      { fontSize: 14, fontWeight: '600', color: '#374151' },
  info:            { marginBottom: 8, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  infoText:        { fontSize: 12, color: '#374151' },
  infoBold:        { fontWeight: '600' },
  listContent:     { paddingBottom: 80 },
  row:             { flexDirection: 'row', marginBottom: 2 },
  cell:            { flex: 1, justifyContent: 'center', paddingHorizontal: 1 },
  cellText:        { margin: 1, padding: 4, fontSize: 14, color: '#1F2937' },
  listItem:        { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderColor: '#ccc' },

  folderTagWrap:   { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
  folderTag:       { backgroundColor: '#e3f2fd', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  folderTagText:   { fontSize: 10, color: '#1565c0', fontWeight: '600' },

  // Detail modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  detailCard:      { width: '88%', backgroundColor: '#d1f0f7', borderRadius: 15, padding: 24, maxHeight: '85%' },
  detailEnglish:   { fontSize: 36, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 4 },
  detailPhonetic:  { fontSize: 20, color: '#333', textAlign: 'center', marginBottom: 8 },
  detailJapanese:  { fontSize: 32, fontWeight: '700', color: '#000', textAlign: 'center', marginBottom: 16 },
  exampleBox:      { borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#4a90e2', padding: 10, borderRadius: 5, marginBottom: 16 },
  exampleText:     { fontSize: 16, color: '#000', textAlign: 'center' },
  folderBox:       { backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'center', marginBottom: 16 },
  tagButtonText:   { fontSize: 14, color: '#1565c0', fontWeight: '600' },

  detailBtnRow:    { flexDirection: 'row', gap: 8, marginTop: 8 },
  detailBtn:       { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  editBtn:         { backgroundColor: '#0a7ea4' },
  editBtnText:     { color: '#fff', fontWeight: '600' },
  deleteBtn:       { backgroundColor: '#fde8e8' },
  deleteBtnText:   { color: '#c0392b', fontWeight: '600' },
  closeBtn:        { backgroundColor: 'rgba(0,0,0,0.08)' },
  closeBtnText:    { color: '#333', fontWeight: '600' },

  // Edit mode
  editSectionTitle:{ fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 16, textAlign: 'center' },
  editLabel:       { fontSize: 13, color: '#555', marginBottom: 4, fontWeight: '600' },
  editInput:       { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fff', marginBottom: 14 },
  editBtnRow:      { flexDirection: 'row', gap: 10, marginTop: 8 },
  editActionBtn:   { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn:       { backgroundColor: 'rgba(0,0,0,0.08)' },
  cancelBtnText:   { color: '#333', fontWeight: '600' },
  saveEditBtn:     { backgroundColor: '#0a7ea4' },
  saveEditBtnText: { color: '#fff', fontWeight: '600' },

  // Add word modal
  modalContainer:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent:    { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '90%' },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 20, fontWeight: 'bold' },
  closeButton:     { fontSize: 28, color: '#666' },
  input:           { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 15, fontSize: 16, marginBottom: 15 },
  folderLabel:     { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  noFolders:       { fontSize: 13, color: '#888', fontStyle: 'italic', marginBottom: 16 },
  folderRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  folderPill:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  folderPillText:  { fontSize: 13, fontWeight: '600' },
  saveButton:      { backgroundColor: '#0a7ea4', padding: 15, borderRadius: 8, alignItems: 'center' },
  saveButtonText:  { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  addButton:       { position: 'absolute', bottom: 30, right: 30, width: 54, height: 54, borderRadius: 32, backgroundColor: '#0a7ea4', justifyContent: 'center', alignItems: 'center' },
  addButtonText:   { color: '#fff', fontSize: 38, fontWeight: 'bold', marginTop: -2 },
});


