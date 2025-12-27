import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { BACKEND_URL } from '../config'; 

export default function TranslateScreen() {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [loading, setLoading] = useState(false);

  

  // 翻訳処理
  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
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

  // 単語カードへ保存
  const handleSaveWord = async () => {
    if (!inputText.trim() || !translatedText.trim()) {
      Alert.alert("Error", "Please save after translate");
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/save_word`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_text: inputText,
          translated_text: translatedText,
          source_lang: 'en',
          target_lang: 'ja',
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        Alert.alert("Saved!", "Success to save the word");
      } else {
        Alert.alert("Error", "Fail to save the word");
      }

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Can't save!");
    }
  };

  return (
    <View style={{flex: 1, padding:16, backgroundColor:"#90c5dcff"}}>
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

          <Button title="Save to Word List" onPress={handleSaveWord} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "transparent",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 6,
    minHeight: 100,
    marginBottom: 12,
  },
  resultBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    gap: 10,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  resultText: {
    marginTop: 4,
    fontSize: 16,
  },
});