import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { faq } from "./web-faq";

interface FaqEntry {
  question: string;
  answer: string;
}

const README = fileURLToPath(new URL("../../README.md", import.meta.url));

/** Everything between the `## FAQ` heading and the next second-level heading. */
const faqSection = (markdown: string): string => {
  const heading = "\n## FAQ\n";
  const start = markdown.indexOf(heading);
  if (start === -1) throw new Error("README.md has no `## FAQ` section");
  const body = markdown.slice(start + heading.length);
  const end = body.search(/\n## /);
  return end === -1 ? body : body.slice(0, end);
};

/** Each `### question` heading paired with the prose beneath it. */
const parseFaq = (section: string): FaqEntry[] =>
  section
    .split(/\n### /)
    .slice(1)
    .map((block) => {
      const [question, ...rest] = block.split("\n");
      return { question: question.trim(), answer: rest.join("\n").trim() };
    });

const fromReadme = parseFaq(faqSection(readFileSync(README, "utf8")));

describe("the FAQ has one wording, in two views", () => {
  it("finds a non-empty FAQ section in the README", () => {
    expect(fromReadme.length).toBeGreaterThan(0);
  });

  it("lists the same questions in the same order as the component", () => {
    expect(fromReadme.map((entry) => entry.question)).toEqual(
      faq.map((entry) => entry.question),
    );
  });

  it("gives the answer the README gives, word for word", () => {
    expect(fromReadme).toEqual(
      faq.map((entry) => ({ question: entry.question, answer: entry.answer })),
    );
  });
});
