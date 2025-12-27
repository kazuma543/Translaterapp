import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet,Alert,Platform } from "react-native";
import { BACKEND_URL } from '../config'; 

export default function WordListScreen() {
  const [words, setWords] = useState([]);
  useEffect(() => {
    fetch(`${BACKEND_URL}/words`)
      .then(res => res.json())
      .then(data => setWords(data));
  }, []);
  const [sortConfig, setSortConfig] = useState({key: null, direction: null});
  const sortBy = (key) => {
    let direction = 'asc';

    if (sortConfig.key === key && sortConfig.direction === 'asc'){
      direction = 'desc';
    }
    const sorted = [...words].sort((a,b) => {
      let aValue, bValue;
      if (key === 'english') {
        const isAJapanese = isJapanese(a.source_text);
        const isBJapanese = isJapanese(b.source_text);
        aValue = isAJapanese ? a.translated_text : a.source_text;
        bValue = isBJapanese ? b.translated_text : b.source_text;
      } else if (key === 'japanese') {
        const isAJapanese = isJapanese(a.source_text);
        const isBJapanese = isJapanese(b.source_text);
        aValue = isAJapanese ? a.source_text : a.translated_text;
        bValue = isBJapanese ? b.source_text : b.translated_text;
      } else {
        aValue = a[key];
        bValue = b[key];
      }
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });


    setWords(sorted);
    setSortConfig({key, direction});
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "⇅";
    
    return sortConfig.direction =='asc'
      ?  '↑' : '↓';
  };
  
  const renderHeader = () => (
    <View style={styles.headerRow}>
      <TouchableOpacity
      style={styles.headerCell}
      onPress={() => sortBy('id')}
      >
        <Text style={styles.headerText}>ID{getSortIcon('id')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.headerCell}
        onPress={()=> sortBy('english')}
      >
        <Text style = {styles.headerText}>English{getSortIcon('english')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.headerCell}
        onPress={()=> sortBy('japanese')}
      >
        <Text style = {styles.headerText}>Japanese{getSortIcon('japanese')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
      style={styles.headerCell}
      onPress={() => sortBy('known')}
      >
        <Text style = {styles.headerText}>Memorised{getSortIcon('known')}</Text>
    </TouchableOpacity>
    </View>
  )  
  const isJapanese = (text) => {
    if (!text) return false;
    // ひらがな、カタカナ、漢字のいずれかが含まれていれば日本語
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  };
  const deleteCard = (id) =>{
    if (Platform.OS === 'web') {
      // Web の場合は confirm を使用
      if (window.confirm('このカードを削除しますか？')) {
        deleteItem(id);
      }
    } else {
      // iOS/Android の場合は Alert を使用
      Alert.alert(
        '削除確認',
        'このカードを削除しますか？',
        [
          {
            text: 'キャンセル',
            style: 'cancel'
          },
          {
            text: '削除',
            onPress: () => deleteItem(id),
            style: 'destructive'
          }
        ]
      );
    }
  };

  const deleteItem= (id) => {
    fetch('${BACKEND_URL/delete_word',{
      method: 'POST',
      headers: {
        "Content-Type":"application/json"
      },
      body: JSON.stringify({id:id})
    })  
      .then(res => res.json())
      
    .then(() => {
      setWords(prevWords => prevWords.filter(w => w.id !== id));
    })
    .catch(err => {
      console.error('Error deleting word:', err);
      Alert.alert('エラー', '削除に失敗しました');
    });
  };

  const renderItem = ({ item }) => {
    const isSourceJapanese = isJapanese(item.source_text);
    const englishText = isSourceJapanese ? item.translated_text : item.source_text;
    const japaneseText = isSourceJapanese ? item.source_text : item.translated_text;
    
  return(

      <TouchableOpacity
        key={item.id}
        onLongPress={() => deleteCard(item.id)}
        style={{padding:15, borderBottomWidth:1, borderColor: '#ccc'}}
      >

    <View style={styles.row}>
      <View style={styles.cell}>
        <Text style={styles.cellText}>{item.id}</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.cellText}>{englishText}</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.cellText}>{japaneseText}</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.cellText}>{item.known ? '✓' : '✗'}</Text>
      </View>

    </View>
    </TouchableOpacity>
    );
  
  };



  const getSortLabel = () => {
    if (!sortConfig.key) return 'Original';
    
    let label = '';
    if (sortConfig.key === 'id') label = 'ID';
    if (sortConfig.key === 'english') label = 'Englsih';
    if (sortConfig.key === 'japanese')label = 'Japanse';
    if (sortConfig.key === 'known') label = 'Known';
    
    const direction = sortConfig.direction === 'asc' ? 'Up' : 'Down';
    return `${label} (${direction})`;
  };
  return (
    <View style={{flex:1, padding:20, backgroundColor:"#90c5dcff",  }}>
      {renderHeader()}
      
      <FlatList
        data={words}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
      
      <View style={styles.info}>
        <Text style={styles.infoText}>
          <Text style={styles.infoBold}>Current order: </Text>
          <Text>{getSortLabel()}</Text>
        </Text>
      </View>
    </View>
  );

  
}


const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#1a7adbff',
    borderRadius: 8,
    marginBottom: 12,
  },
  headerCell: {
    padding:8,
    margin: 8,
    alignItems: 'stretch',
  },
  headerText: {
    flexDirection:'row',
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  cell: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cellText: {
    margin:8,
    padding:8,
    fontSize: 14,
    color: '#1F2937',
  },
  translatedRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  translated: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  info: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#374151',
  },
  infoBold: {
    fontWeight: '600',
  },
});