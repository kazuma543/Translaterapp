import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ActivityIndicator, Alert
} from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import { BACKEND_URL } from "../config";
// 他のインポートの下に追加
import { useAuth } from '../context/AuthContext'

export default function FlashCardStudy({ route, navigation }) {
  const { folder } = route.params;

  const [cards, setCards]           = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading]       = useState(true);
  const { authFetch } = useAuth();
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    authFetch(`${BACKEND_URL}/words_in_folder/${folder.id}`)
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

  // 汎用的なレビュー処理関数 (スワイプとボタンの両方から呼び出す)
  const processReview = (qualityScore) => {
    const word = cards[currentIndex];
    if (!word) return;

    authFetch(`${BACKEND_URL}/review_word`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: word.id,
        quality: qualityScore
      }),
    })
    .then(res => res.json())
    .then(data => console.log("Review saved:", data))
    .catch(err => console.error("Error saving review:", err));

    setShowAnswer(false);
    setCurrentIndex((prev) => prev + 1);
  };

  // スワイプ用
  const handleSwipe = (direction) => {
    const score = (direction === "right") ? 4 : 2;
    processReview(score);
  };

  // ボタン用（エラーが出ていた handleReview をここで定義）
  const handleReview = (quality) => {
    processReview(quality);
  };

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.state === 5) { // END
      const { translationX } = event.nativeEvent;
      if (translationX > 100) {
        handleSwipe("right");
      } else if (translationX < -100) {
        handleSwipe("left");
      }
      Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  if (currentIndex >= cards.length) {
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerBack}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{folder.name}</Text>
        <Text style={styles.headerCount}>{currentIndex + 1} / {cards.length}</Text>
      </View>

      <View style={styles.progressWrap}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View style={[styles.card, { transform: [{ translateX }] }]}>
          <TouchableOpacity onPress={() => setShowAnswer(!showAnswer)} activeOpacity={0.9} style={{width:'100%', alignItems:'center'}}>
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

      {/* 学習ボタン：スコア 1(Again), 3(Good), 5(Easy) */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.btnAgain]} onPress={() => handleReview(1)}>
          <Text style={styles.btnText}>Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.btnGood]} onPress={() => handleReview(3)}>
          <Text style={styles.btnText}>Good</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.btnEasy]} onPress={() => handleReview(5)}>
          <Text style={styles.btnText}>Easy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
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
    padding: 40,
    alignItems: "center",
    minHeight: 220,
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardSource:       { fontSize: 26, fontWeight: "bold", color: "#2480a4", textAlign: "center" },
  divider:          { height: 0.5, backgroundColor: "#eee", width: "80%", marginVertical: 14 },
  cardAnswer:       { fontSize: 20, fontWeight: "600", color: "#1a1a1a", textAlign: "center" },
  phonetic:         { fontSize: 13, color: "#888", fontStyle: "italic", marginTop: 6 },
  hint:             { marginTop: 16, textAlign: "center", color: "#444", fontSize: 12 },
  
  // ボタンのスタイル
  btnRow:           { flexDirection: "row", justifyContent: "space-between", marginTop: 40, gap: 10 },
  actionBtn:        { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", elevation: 2 },
  btnAgain:         { backgroundColor: "#f44336" },
  btnGood:          { backgroundColor: "#2196f3" },
  btnEasy:          { backgroundColor: "#4caf50" },
  btnText:          { color: "#fff", fontWeight: "bold", fontSize: 14 },

  finishEmoji:      { fontSize: 48, marginBottom: 12 },
  finishTitle:      { fontSize: 26, fontWeight: "bold", color: "#1a1a1a", marginBottom: 6 },
  finishSub:        { fontSize: 14, color: "#555", textAlign: "center", marginBottom: 30 },
  backBtn:          { backgroundColor: "#2196f3", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
  backBtnText:      { color: "#fff", fontSize: 15, fontWeight: "600" },
});