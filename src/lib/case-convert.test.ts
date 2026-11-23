import { describe, expect, it } from "vitest";
import {
  convertCase,
  toAlternatingCase,
  toCamelCase,
  toInverseCase,
  toKebabCase,
  toLower,
  toPascalCase,
  toSentenceCase,
  toSnakeCase,
  toTitleCase,
  toUpper,
} from "./case-convert";

describe("basic conversions", () => {
  it("upper and lower", () => {
    expect(convertCase("Hello World", "upper")).toBe("HELLO WORLD");
    expect(convertCase("Hello World", "lower")).toBe("hello world");
  });

  it("title case capitalizes major words, keeps minor words lowercase", () => {
    expect(toTitleCase("the quick brown fox and the hat")).toBe(
      "The Quick Brown Fox and the Hat",
    );
  });

  it("title case keeps first and last words capitalized even if minor", () => {
    expect(toTitleCase("a tale of two cities")).toBe("A Tale of Two Cities");
    expect(toTitleCase("the shape of water")).toBe("The Shape of Water");
  });

  it("sentence case capitalizes after sentence enders", () => {
    expect(toSentenceCase("hello there. this is NEXT! ok? yes.")).toBe(
      "Hello there. This is next! Ok? Yes.",
    );
  });

  it("camel / pascal / snake / kebab", () => {
    expect(toCamelCase("user login count")).toBe("userLoginCount");
    expect(toCamelCase("Already-Camel_case")).toBe("alreadyCamelCase");
    expect(toPascalCase("my tool page")).toBe("MyToolPage");
    expect(toSnakeCase("PageTitle here")).toBe("page_title_here");
    expect(toKebabCase("PageTitle here")).toBe("page-title-here");
    expect(toSnakeCase("HTTPServer2 response")).toBe("http_server2_response");
  });

  it("alternating and inverse", () => {
    expect(toAlternatingCase("abcdef")).toBe("aBcDeF");
    expect(toInverseCase("Hello World")).toBe("hELLO wORLD");
  });

  it("preserves line breaks", () => {
    expect(toUpper("a\nb")).toBe("A\nB");
  });
});

describe("unicode handling", () => {
  it("keeps accented letters in word-aware styles", () => {
    expect(toCamelCase("café au lait")).toBe("caféAuLait");
    expect(toSnakeCase("Über Straße")).toBe("über_straße");
    expect(toKebabCase("déjà vu")).toBe("déjà-vu");
    expect(toPascalCase("naïve résumé")).toBe("NaïveRésumé");
  });

  it("splits camel humps with non-ASCII letters", () => {
    expect(toSnakeCase("caféCrème")).toBe("café_crème");
  });

  it("sentence case capitalizes accented sentence starters", () => {
    expect(toSentenceCase("élan. über alles! ok?")).toBe("Élan. Über alles! Ok?");
  });

  it("alternating case includes non-ASCII letters", () => {
    expect(toAlternatingCase("àbçd")).toBe("àBçD");
  });

  it("upper/lower use standard unicode mappings (ß → SS)", () => {
    expect(toUpper("Straße")).toBe("STRASSE");
    expect(toLower("STRASSE")).toBe("strasse");
  });

  it("title case capitalizes whole code points", () => {
    expect(toTitleCase("élan vital")).toBe("Élan Vital");
  });
});
