import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  // State
  const [serverUrl, setServerUrl] = useState('http://');
  const [references, setReferences] = useState([]);
  const [filteredReferences, setFilteredReferences] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState('Never');
  
  // Selection/Detail State
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Load cache on startup
  useEffect(() => {
    loadCachedData();
  }, []);

  const loadCachedData = async () => {
    try {
      const cachedRefs = await AsyncStorage.getItem('mendeley_references');
      const cachedIp = await AsyncStorage.getItem('mendeley_server_url');
      const cachedSyncDate = await AsyncStorage.getItem('mendeley_last_synced');

      if (cachedRefs) {
        const parsed = JSON.parse(cachedRefs);
        setReferences(parsed);
        setFilteredReferences(parsed);
      }
      if (cachedIp) {
        setServerUrl(cachedIp);
      }
      if (cachedSyncDate) {
        setLastSynced(cachedSyncDate);
      }
    } catch (err) {
      console.error('Failed to load cached mobile database:', err);
    }
  };

  // Sync references from server
  const handleSync = async () => {
    const formattedUrl = serverUrl.trim();
    if (!formattedUrl || formattedUrl === 'http://') {
      Alert.alert('Configuration Required', 'Please enter your local computer\'s IP address (e.g. http://192.168.1.50:3000)');
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch(`${formattedUrl}/api/references`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.references)) {
        const list = data.references;
        
        // Save to state
        setReferences(list);
        setFilteredReferences(list);
        
        // Save to cache
        const dateStr = new Date().toLocaleString();
        setLastSynced(dateStr);
        await AsyncStorage.setItem('mendeley_references', JSON.stringify(list));
        await AsyncStorage.setItem('mendeley_server_url', formattedUrl);
        await AsyncStorage.setItem('mendeley_last_synced', dateStr);

        Alert.alert('Sync Successful', `Downloaded ${list.length} papers from your local server!`);
      } else {
        throw new Error('Invalid database format received from server.');
      }
    } catch (err) {
      console.error('Sync failed:', err);
      Alert.alert(
        'Sync Failed',
        `Could not connect to server at ${formattedUrl}.\n\nEnsure:\n1. Your local server is running.\n2. Your phone is on the SAME Wi-Fi network as your computer.`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // Real-time Search Filter
  const handleSearch = (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredReferences(references);
      return;
    }

    const query = text.toLowerCase();
    const filtered = references.filter(ref => {
      const titleMatch = ref.title && ref.title.toLowerCase().includes(query);
      const sourceMatch = ref.source && ref.source.toLowerCase().includes(query);
      const abstractMatch = ref.abstract && ref.abstract.toLowerCase().includes(query);
      const yearMatch = ref.year && ref.year.toString().includes(query);
      
      let authorMatch = false;
      if (ref.authors && Array.isArray(ref.authors)) {
        authorMatch = ref.authors.some(a => 
          (a.first_name && a.first_name.toLowerCase().includes(query)) ||
          (a.last_name && a.last_name.toLowerCase().includes(query))
        );
      }

      return titleMatch || sourceMatch || abstractMatch || yearMatch || authorMatch;
    });

    setFilteredReferences(filtered);
  };

  // Open Paper Detail Modal
  const openPaperDetails = (paper) => {
    setSelectedPaper(paper);
    setDetailModalVisible(true);
  };

  // Author String Formatter
  const formatAuthors = (authors) => {
    if (!authors || authors.length === 0) return 'Unknown Authors';
    return authors.map(a => `${a.first_name || ''} ${a.last_name || ''}`.trim()).join(', ');
  };

  // Get Badge Color Style based on reference type
  const getBadgeStyle = (type) => {
    const t = (type || 'generic').toLowerCase();
    if (t === 'journal') return styles.badgeJournal;
    if (t === 'book') return styles.badgeBook;
    if (t === 'patent') return styles.badgePatent;
    return styles.badgeGeneric;
  };

  const getBadgeTextStyle = (type) => {
    const t = (type || 'generic').toLowerCase();
    if (t === 'journal') return styles.badgeTextJournal;
    if (t === 'book') return styles.badgeTextBook;
    if (t === 'patent') return styles.badgeTextPatent;
    return styles.badgeTextGeneric;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070913" />
      
      {/* Background ambient accents */}
      <View style={styles.glowTop} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header Block */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📚 Mendeley Library</Text>
          <Text style={styles.headerSubtitle}>Local Sync & Offline Viewer</Text>
        </View>

        {/* Sync Settings Card */}
        <View style={styles.syncCard}>
          <Text style={styles.syncCardTitle}>WIFI SYNCHRONIZATION</Text>
          <View style={styles.syncInputRow}>
            <TextInput
              style={styles.syncInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.1.XX:3000"
              placeholderTextColor="#556"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity 
              style={styles.syncBtn} 
              onPress={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.syncBtnText}>Sync</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.syncMetaRow}>
            <Text style={styles.syncMetaText}>Papers: {references.length}</Text>
            <Text style={styles.syncMetaText}>Last: {lastSynced}</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Search title, author, year, journal..."
            placeholderTextColor="#889"
            clearButtonMode="while-editing"
          />
        </View>

        {/* References List */}
        <FlatList
          data={filteredReferences}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const authorText = formatAuthors(item.authors);
            return (
              <TouchableOpacity 
                style={styles.paperCard}
                onPress={() => openPaperDetails(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, getBadgeStyle(item.type)]}>
                    <Text style={[styles.badgeText, getBadgeTextStyle(item.type)]}>{item.type || 'generic'}</Text>
                  </View>
                  <Text style={styles.cardYear}>{item.year || 'N/A'}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardAuthors} numberOfLines={1}>{authorText}</Text>
                {item.source ? (
                  <Text style={styles.cardSource} numberOfLines={1}>📖 {item.source}</Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyTitle}>No references found</Text>
              <Text style={styles.emptyDesc}>
                {references.length === 0 
                  ? 'Input your computer\'s server URL and tap Sync to download your Mendeley references.'
                  : 'No papers match your search term.'}
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>

      {/* PAPER DETAIL MODAL */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderRow}>
                <View style={[styles.badge, selectedPaper && getBadgeStyle(selectedPaper.type)]}>
                  <Text style={[styles.badgeText, selectedPaper && getBadgeTextStyle(selectedPaper.type)]}>
                    {selectedPaper?.type || 'generic'}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.modalCloseBtn}
                  onPress={() => setDetailModalVisible(false)}
                >
                  <Text style={styles.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalTitle}>{selectedPaper?.title}</Text>
              <Text style={styles.modalAuthors}>{selectedPaper && formatAuthors(selectedPaper.authors)}</Text>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Meta Panel */}
              <View style={styles.metaPanel}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Source</Text>
                  <Text style={styles.metaVal} numberOfLines={1}>{selectedPaper?.source || 'N/A'}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Year</Text>
                  <Text style={styles.metaVal}>{selectedPaper?.year || 'N/A'}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>DOI</Text>
                  <Text style={styles.metaVal} numberOfLines={1}>{selectedPaper?.doi || 'N/A'}</Text>
                </View>
              </View>

              {/* Abstract */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>ABSTRACT</Text>
                <Text style={styles.abstractText}>
                  {selectedPaper?.abstract || 'No abstract is available for this reference document.'}
                </Text>
              </View>

              {/* Date Created */}
              <View style={[styles.section, { marginBottom: 40 }]}>
                <Text style={styles.sectionTitle}>METADATA</Text>
                <Text style={styles.metaDetail}>ID: {selectedPaper?.id}</Text>
                <Text style={styles.metaDetail}>Sync Date: {selectedPaper?.created}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070913',
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    filter: 'blur(50px)',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#889',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  
  // Sync card styling
  syncCard: {
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: 'rgba(22, 28, 45, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  syncCardTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a5b4fc',
    letterSpacing: 1,
    marginBottom: 10,
  },
  syncInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  syncInput: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 14,
  },
  syncBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  syncMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  syncMetaText: {
    fontSize: 11,
    color: '#889',
  },

  // Search
  searchContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: 'rgba(22, 28, 45, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 14,
  },

  // List & Cards
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  paperCard: {
    backgroundColor: 'rgba(22, 28, 45, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeJournal: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  badgeBook: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  badgePatent: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  badgeGeneric: {
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.2)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeTextJournal: { color: '#a5b4fc' },
  badgeTextBook: { color: '#6ee7b7' },
  badgeTextPatent: { color: '#fcd34d' },
  badgeTextGeneric: { color: '#d1d5db' },
  
  cardYear: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 20,
    marginBottom: 6,
  },
  cardAuthors: {
    fontSize: 12,
    color: '#889',
    marginBottom: 6,
  },
  cardSource: {
    fontSize: 11,
    color: '#889',
    fontStyle: 'italic',
  },

  // Empty List State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#889',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 5, 11, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0d111e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    maxHeight: '85%',
    paddingTop: 24,
  },
  modalHeader: {
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#889',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 24,
    marginBottom: 8,
  },
  modalAuthors: {
    fontSize: 13,
    color: '#38bdf8',
    fontWeight: '500',
  },
  modalScroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  
  // Meta Panel
  metaPanel: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  metaItem: {
    flex: 1,
    marginRight: 8,
  },
  metaLabel: {
    fontSize: 9,
    color: '#889',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  abstractText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#889',
  },
  metaDetail: {
    fontSize: 11,
    color: '#889',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  }
});
