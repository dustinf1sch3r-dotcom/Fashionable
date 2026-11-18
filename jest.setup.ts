// Any test that imports `@/services` pulls in the AsyncStorage adapter, whose native module must be mocked.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
