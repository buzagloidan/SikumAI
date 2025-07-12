import React from 'react';
import { View, StyleSheet } from 'react-native';

const GoogleLogo = ({ style }) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.outer}>
        <View style={styles.inner}>
          <View style={styles.redPart} />
          <View style={styles.yellowPart} />
          <View style={styles.greenPart} />
          <View style={styles.bluePart} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
  },
  outer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    width: '85%',
    height: '85%',
    borderRadius: 12,
    backgroundColor: 'white',
    overflow: 'hidden',
    position: 'relative',
  },
  redPart: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '50%',
    height: '50%',
    backgroundColor: '#EA4335',
  },
  yellowPart: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '50%',
    height: '50%',
    backgroundColor: '#FBBC05',
  },
  greenPart: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '50%',
    height: '50%',
    backgroundColor: '#34A853',
  },
  bluePart: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '50%',
    height: '50%',
    backgroundColor: '#4285F4',
  }
});

export default GoogleLogo; 