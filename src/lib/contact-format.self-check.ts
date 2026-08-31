import {
  formatAddress,
  formatPhone,
  isValidAddress,
  isValidPhone,
  normalizePhoneE164,
  parseAddress,
  parsePhone,
} from "./contact-format.ts";

if (formatPhone({ countryId: "ET", local: "0911234567" }) !== "+251 911234567") {
  throw new Error("formatPhone should normalize Ethiopian local numbers");
}
if (parsePhone("+251 911234567").countryId !== "ET" || parsePhone("+251 911234567").local !== "911234567") {
  throw new Error("parsePhone should read +251 numbers");
}
if (!isValidPhone({ countryId: "ET", local: "911234567" })) {
  throw new Error("valid Ethiopian mobile should pass");
}
if (isValidPhone({ countryId: "ET", local: "811234567" })) {
  throw new Error("invalid Ethiopian mobile should fail");
}
if (normalizePhoneE164("0911234567") !== "251911234567") {
  throw new Error("normalizePhoneE164 should handle 09… numbers");
}
if (formatAddress({ country: "Ethiopia", city: "Harar", details: "Kebele 03" }) !== "Ethiopia, Harar, Kebele 03") {
  throw new Error("formatAddress should join parts");
}
const parsedHarar = parseAddress("Harar");
if (parsedHarar.city !== "Harar" || parsedHarar.country !== "Ethiopia") {
  throw new Error("parseAddress should recognize legacy city-only values");
}
const parsedStructured = parseAddress("Ethiopia, Harar, Kebele 03");
if (parsedStructured.city !== "Harar" || parsedStructured.details !== "Kebele 03") {
  throw new Error("parseAddress should split structured addresses");
}
if (!isValidAddress({ country: "Ethiopia", city: "Harar", details: "" })) {
  throw new Error("country + city should be valid");
}
if (isValidAddress({ country: "Ethiopia", city: "", details: "" })) {
  throw new Error("missing city should be invalid");
}

console.log("contact-format self-check passed");
