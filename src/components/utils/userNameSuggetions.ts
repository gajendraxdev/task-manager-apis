import { generateRandomString } from "./genRendomString.ts";

const generateBaseNames = (fullname: string) => {
  const clean = fullname.toLocaleLowerCase().trim().replace(/\s+/g, " ");
  const parts = clean.split(" ");

  const first = parts[0] || "";
  const last = parts[parts.length - 1] || "";

  const initials = parts.map((p) => p[0]).join("");

  return { first, last, initials, clean };
};

export const generateUsernames = (fullname: string) => {
  const { first, last, initials } = generateBaseNames(fullname);

  return [
    `${first}${last}`,
    `${first}_${last}`,
    `${first}${generateRandomString(3, { numbers: true })}`,
    `${first}_${generateRandomString(3, { alphabets: true }).toLowerCase()}`,
    `${first}.${last}`,
    `${initials}_${generateRandomString(3, { numbers: true })}`,
    `${first}${last}${generateRandomString(3, { numbers: true })}`,
    `${first}${new Date().getFullYear()}`,
    `${first}_${last}_${generateRandomString(3, { alphabets: true }).toLowerCase()}`,
  ];
};

