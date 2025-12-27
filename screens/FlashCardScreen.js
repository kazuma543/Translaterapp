import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import { BACKEND_URL } from '../config';

export default function FlashCardScreen() {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetch(`${BACKEND_URL}/words`)
      .then((res) => res.json())
      .then((data) => {
        const shuffled = data.sort(() => Math.random() - 0.5);
        setCards(shuffled);
      });
  }, []);

  const handleSwipe = (direction) => {
    const word = cards[currentIndex];

    // === DB 更新 ===
    fetch(`${BACKEND_URL}/update_known`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: word.id,
        known: direction === "right" ? 1 : 0,
      }),
    });

    // 次のカードへ
    setShowAnswer(false);
    setCurrentIndex((prev) => prev + 1);
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: false }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.state === 5) {
      const { translationX } = event.nativeEvent;

      if (translationX > 100) handleSwipe("right"); // 右 → 覚えた
      else if (translationX < -100) handleSwipe("left"); // 左 → まだ

      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: false,
      }).start();
    }
  };

  if (currentIndex >= cards.length) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 24 }}>Finish All Cards!</Text>
      </View>
    );
  }

  const card = cards[currentIndex];

  return (
    <View style={{flex:1, justifyContent: "center", padding:40, backgroundColor:"#90c5dcff"}}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View style={[styles.card, { transform: [{ translateX }] }]}>
          <TouchableOpacity onPress={() => setShowAnswer(!showAnswer)}>
            <Text style={styles.text}>
              {showAnswer ? card.translated_text : card.source_text}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>

      <Text style={styles.hint}>Tap:Answer / Right:Memorised / Left:Not yet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: "#fff",
    padding: 40,
    borderRadius: 10,
    borderWidth:1,
    borderColor: "#060606ff",
    elevation: 4,
    alignItems: "center",
  },
  text: { color:"#2480a4ff",fontSize: 26, fontWeight: "bold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hint: { marginTop: 30, textAlign: "center", color: "#555" },
});