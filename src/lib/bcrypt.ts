import { compare, hash } from "bcrypt";

export const hashString = async (data: string): Promise<string> => {
  return await hash(data, 10);
};

export const compareHashAndData = async (
  data: string,
  hash: string
): Promise<boolean> => {
  return await compare(data, hash);
};
