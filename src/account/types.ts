export type AccountRecord = {
  name: string;
  home: string;
  email?: string;
  createdAt: string;
  lastUsedAt?: string;
};

export type CxsConfig = {
  version: 1;
  defaultAccount?: string;
  accounts: Record<string, AccountRecord>;
};
