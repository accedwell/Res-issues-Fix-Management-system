import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../services/api';

export default function HomeScreen() {
  const [status, setStatus] = useState('Checking backend...');

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setStatus(`Backend: ${res.data.status}`))
      .catch(() => setStatus('Backend: unreachable'));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ResiFix</Text>
      <Text>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
