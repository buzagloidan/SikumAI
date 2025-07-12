import React from 'react';
import { Image, StyleSheet } from 'react-native';

const RobotLogo = ({ style }) => {
  // This component displays the robot logo image
  return (
    <Image
      source={require('./robot-logo.png')}
      style={[styles.image, style]}
      resizeMode="contain"
    />
  );
};

const styles = StyleSheet.create({
  image: {
    width: 120,
    height: 120,
  },
});

export default RobotLogo; 