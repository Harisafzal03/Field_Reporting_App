/* eslint-env jest */
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    getItem: jest.fn(async key => store[key] || null),
    setItem: jest.fn(async (key, value) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn(async key => {
      delete store[key];
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
    getAllKeys: jest.fn(async () => Object.keys(store)),
    multiGet: jest.fn(async keys => keys.map(k => [k, store[k] || null])),
    multiSet: jest.fn(async pairs => {
      pairs.forEach(([k, v]) => {
        store[k] = String(v);
      });
    }),
    multiRemove: jest.fn(async keys => {
      keys.forEach(k => delete store[k]);
    }),
    __getStore: () => store,
    __resetStore: () => {
      store = {};
    },
  };
});
