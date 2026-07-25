import argon2 from "argon2";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
};

export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$/MjTh7mvDv8zh7Z2UbWjOg$cYQK7TR2WQs27WYoPgAsLMXbTGQbQQPaanBUu6f6Hvk";

export const hashPassword = (password) => argon2.hash(password, ARGON2_OPTIONS);

export const verifyPassword = async (passwordHash, password) => {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
};
