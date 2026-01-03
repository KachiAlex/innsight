const createMockFn = <T extends (...args: any[]) => any>(impl?: T) => {
  if (typeof jest === 'undefined') {
    return impl ?? (() => undefined);
  }
  return jest.fn(impl ?? (() => undefined));
};

const mockCollection = () => {
  const chainable = {
    where: createMockFn(() => chainable),
    orderBy: createMockFn(() => chainable),
    limit: createMockFn(() => chainable),
  };

  return {
    ...chainable,
    doc: createMockFn(() => mockDocRef()),
    add: createMockFn(async () => ({ id: 'mock-doc-id' })),
    get: createMockFn(async () => ({ empty: true, docs: [] })),
  };
};

const mockDocRef = () => ({
  id: 'mock-doc-id',
  set: createMockFn(async () => undefined),
  update: createMockFn(async () => undefined),
  delete: createMockFn(async () => undefined),
  get: createMockFn(async () => ({ exists: true, data: () => ({}) })),
  collection: createMockFn(() => mockCollection()),
});

const mockFirestore = () => ({
  collection: createMockFn(() => mockCollection()),
  doc: createMockFn(() => mockDocRef()),
  batch: createMockFn(() => ({
    set: createMockFn(() => undefined),
    update: createMockFn(() => undefined),
    delete: createMockFn(() => undefined),
    commit: createMockFn(async () => undefined),
  })),
});

const mockAuth = () => ({
  verifyIdToken: createMockFn(async () => ({
    uid: 'test-user',
    email: 'test@example.com',
  })),
});

const mockStorage = () => {
  const fileRef = {
    save: createMockFn(async () => undefined),
    delete: createMockFn(async () => undefined),
    getSignedUrl: createMockFn(async () => ['https://example.com/mock-file']),
    exists: createMockFn(async () => [true]),
    createWriteStream: createMockFn(() => ({
      on: createMockFn(() => undefined),
      end: createMockFn(() => undefined),
    })),
    createReadStream: createMockFn(() => ({
      on: createMockFn(() => undefined),
      pipe: createMockFn(() => undefined),
    })),
  };

  return {
    bucket: createMockFn(() => ({
      file: createMockFn(() => fileRef),
    })),
  };
};

const Timestamp = {
  now: createMockFn(() => new Date()),
  fromDate: createMockFn((date: Date) => ({
    toDate: () => date,
  })),
};

const FieldValue = {
  serverTimestamp: createMockFn(() => 'serverTimestamp'),
  arrayUnion: createMockFn((...args: any[]) => args),
  arrayRemove: createMockFn((...args: any[]) => args),
  increment: createMockFn((value: number) => value),
};

const adminModule = {
  initializeApp: createMockFn(() => undefined),
  apps: [],
  auth: mockAuth,
  firestore: () => {
    const firestore = mockFirestore();
    (firestore as any).Timestamp = Timestamp;
    (firestore as any).FieldValue = FieldValue;
    return firestore;
  },
  storage: mockStorage,
  credential: {
    cert: createMockFn(() => ({})),
    applicationDefault: createMockFn(() => ({})),
  },
  firestoreNamespace: {
    Timestamp,
    FieldValue,
  },
  messaging: createMockFn(() => ({
    send: createMockFn(async () => undefined),
  })),
};

module.exports = adminModule;
