import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ActivityIndicator, Alert
} from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import { BACKEND_URL } from "../config";

export default function FlashCardStudy({ route, navigation }) {
  const { folder } = route.params;

  const [cards, setCards]           = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading]       = useState(true);

  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetch(`${BACKEND_URL}/words_in_folder/${folder.id}`)
      .then((res) => res.json())
      .then((data) => {
        const shuffled = data.sort(() => Math.random() - 0.5);
        setCards(shuffled);
      })
      .catch(() => Alert.alert("Error", "Could not load words."))
      .finally(() => setLoading(false));
  }, [folder.id]);

const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: false }
  );
const handleSwipe = (direction) => {
  // 1. 現在のカードを取得
  const word = cards[currentIndex];
  
  // カードが存在しない場合は何もしない
  if (!word) return;

  // 2. 方向に基づいてスコア(quality)を決定
  // 右スワイプなら 4 (正解)、左スワイプなら 2 (不十分)
  const qualityScore = (direction === "right") ? 4 : 2;

  // 3. サーバーへ送信
  fetch(`${BACKEND_URL}/review_word`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: word.id,          // ここを word.id に修正
      quality: qualityScore // 計算したスコアを送信
    }),
  })
  .then(res => res.json())
  .then(data => {
    console.log("Review saved:", data);
  })
  .catch(err => console.error("Error saving review:", err));

  // 4. UIの状態を更新（次のカードへ）
  setShowAnswer(false);
  setCurrentIndex((prev) => prev + 1);
};

// ジェスチャー完了時の処理
const onHandlerStateChange = (event) => {
  if (event.nativeEvent.state === 5) { // 5 は State.END (ジェスチャー終了)
    const { translationX } = event.nativeEvent;
    
    if (translationX > 100) {
      handleSwipe("right");
    } else if (translationX < -100) {
      handleSwipe("left");
    }

    // カードを中央に戻すアニメーション
    Animated.spring(translateX, { 
      toValue: 0, 
      useNativeDriver: false 
    }).start();
  }
};

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  // Finished all cards
  if (currentIndex >= cards.length) {
    const memorised = cards.length; // approximate — all reviewed
    return (
      <View style={styles.center}>
        <Text style={styles.finishEmoji}>🎉</Text>
        <Text style={styles.finishTitle}>All done!</Text>
        <Text style={styles.finishSub}>You reviewed {cards.length} cards in {folder.name}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Back to folders</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const card     = cards[currentIndex];
  const progress = currentIndex / cards.length;

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerBack}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{folder.name}</Text>
        <Text style={styles.headerCount}>{currentIndex + 1} / {cards.length}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Card */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View style={[styles.card, { transform: [{ translateX }] }]}>
          <TouchableOpacity onPress={() => setShowAnswer(!showAnswer)} activeOpacity={0.9}>
            {showAnswer ? (
              <>
                <Text style={styles.cardSource}>{card.source_text}</Text>
                <View style={styles.divider} />
                <Text style={styles.cardAnswer}>{card.translated_text}</Text>
                {card.phonetic ? (
                  <Text style={styles.phonetic}>/ {card.phonetic} /</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.cardSource}>{card.source_text}</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>

      <Text style={styles.hint}>Tap: Answer  ·  Right: Memorised  ·  Left: Not yet</Text>

      {/* Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity onPress={() => handleReview(1)}>
          <Text>Again</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleReview(3)}>
          <Text>Good</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleReview(5)}>
          <Text>Easy</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
  navigation.navigate("WordList", { refresh: true });
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#90c5dc", padding: 20, paddingTop: 30 },
  center:           { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#90c5dc", padding: 30 },

  header:           { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  headerBack:       { fontSize: 18, color: "#2196f3", marginRight: 8 },
  headerTitle:      { flex: 1, fontSize: 16, fontWeight: "600", color: "#1a1a1a" },
  headerCount:      { fontSize: 13, color: "#555" },

  progressWrap:     { height: 5, backgroundColor: "rgba(255,255,255,0.4)", borderRadius: 3, marginBottom: 30 },
  progressFill:     { height: 5, backgroundColor: "#2196f3", borderRadius: 3 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 40,
    alignItems: "center",
    minHeight: 180,
    justifyContent: "center",
  },
  cardSource:       { fontSize: 26, fontWeight: "bold", color: "#2480a4", textAlign: "center" },
  divider:          { height: 0.5, backgroundColor: "#eee", width: "80%", marginVertical: 14 },
  cardAnswer:       { fontSize: 20, fontWeight: "600", color: "#1a1a1a", textAlign: "center" },
  phonetic:         { fontSize: 13, color: "#888", fontStyle: "italic", marginTop: 6 },

  hint:             { marginTop: 16, textAlign: "center", color: "#444", fontSize: 12 },

  btnRow:           { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", flexDirection: "row", gap: 12, marginTop: 24 },
  actionBtn:        { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnNotYet:        { backgroundColor: "#fde8e8" },
  btnNotYetText:    { color: "#c0392b", fontWeight: "600", fontSize: 15 },
  btnMemorised:     { backgroundColor: "#e8f5e9" },
  btnMemorisedText: { color: "#2e7d32", fontWeight: "600", fontSize: 15 },

  finishEmoji:      { fontSize: 48, marginBottom: 12 },
  finishTitle:      { fontSize: 26, fontWeight: "bold", color: "#1a1a1a", marginBottom: 6 },
  finishSub:        { fontSize: 14, color: "#555", textAlign: "center", marginBottom: 30 },
  backBtn:          { backgroundColor: "#2196f3", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
  backBtnText:      { color: "#fff", fontSize: 15, fontWeight: "600" },
});