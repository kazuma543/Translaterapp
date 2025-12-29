import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet,Alert,Platform,RefreshControl,Modal,TextInput,KeyboardAvoidingView } from "react-native";
import { BACKEND_URL } from '../config'; 

export default function WordListScreen() {
  const [words, setWords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newWord, setNewWord] = useState({
    sousrce_text: '',
    translated_text: ''
  });
  useEffect(() => {
    fetch(`${BACKEND_URL}/words`)
      .then(res => res.json())
      .then(data => setWords(data));
  }, []);

  const onRefreshing = async ()=>{
    setRefreshing(true);
    await fetchWords();
    setRefreshing(false);
  }
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
    fetch(`${BACKEND_URL}/delete_word`,{
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

  const handleAddWord = async () =>{
    if (!newWord.source_text.trim() || !newWord.translated_text.trim()){
      Alert.alert("Error!");
      return;
    }
  try{
    const response = await fetch(`${BACKEND_URL}/save_word`,{
      method: 'POST',
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        source_text: newWord.source_text,
        translated_text:newWord.translated_text,
      }),
    });

    const data = await response.json();

    if (data.status === "success"){
      Alert.alert("Success");
      setModalVisible(false);
      setNewWord({source_text:'', translated_text:''});
      fetchWords();
    }else{
      Alert.alert('Error!');
    }
  } catch (error){
    console.error("Error to save:", error);
    Alert.alert("Error", "Fail to save");
  }
  };

  return (
    <View style={{flex:1, padding:20, backgroundColor:"#90c5dcff",  }}>
      {/*+button*/}
      {renderHeader()}
      <View style={styles.header}>
        <TouchableOpacity
        style={styles.addButton}
        onPress={()=> setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
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
      <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
        behavior = {Platform.OS === "ios" ? "padding" : "height"}
        style = {styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Word</Text>
              <TouchableOpacity onPress={() => setModalVisibel(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
            style = {styles.input}
            placeholder="Original language"
            value={newWord.source_text}
            onChangeText={(text) =>
              setNewWord({...newWord, source_text: text })
            }
            autoCapitalize="none"
            />
            <TextInput
            style={styles.input}
            placeholder="Translate"
            value={newWord.translated_text}
            onChangeText={(text) =>
              setNewWord({...newWord, translated_text: text})
            }
            />

            <TouchableOpacity
            style={styles.saveButton}
            onPress={handleAddWord}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  addButton:{
    width:44,
    height:44,
    borderRadius: 22,
    backgroundColor: '#0a7ea4',
    justifyContent:'center',
    alignItems:'center',
    shadowColor: '#000',
    shadowOffset: {width: 0 , height:2},
    shadowOpacity:0.3,
    shadowRadius:3,
    elevation: 5,
  },
  addButtonText:{
    color :'#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop:-2,
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
  modalContainer:{
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor:'rgba(0,0,0,0.5)',
  },
  modalContent:{
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius:20,
    padding: 20,
    paddingBottom:40,
  },
  modalHeader:{
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle:{
    fontSize:20,
    fontWeight:'bold',
  },
  closeButton:{
    fontSize: 28,
    color: '#666'
  },
  input:{
    borderWidth:1,
    borderColor:'#ddd',
    borderRadius:8,
    padding:15,
    fontSize:16,
    marginBottom:15,
    backgroundColor:'#fff'
  },
  saveButton:{
    backgroundColor:'#0a7ea4',
    padding:15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop:10,
  },
  saveButtonText:{
    color:'#fff',
    fontSize:16,
    fontWeight:'bold',
  }

});