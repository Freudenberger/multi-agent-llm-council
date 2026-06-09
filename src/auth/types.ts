export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
};

export type UserPublic = {
  id: string;
  email: string;
  name: string;
};
