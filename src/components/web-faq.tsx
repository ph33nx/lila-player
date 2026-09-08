/**
 * FAQ shown only on the web build (NEXT_PUBLIC_TARGET=web), never in the
 * desktop app. The visible copy and the FAQPage structured data are both
 * generated from the `faq` array below, so they cannot drift apart.
 *
 * The README's FAQ section is this same list; `web-faq.test.ts` keeps them identical.
 */

import { IS_WEB } from "@/utils/site";
export const faq = [
  {
    question: "Is Lila Player free?",
    answer:
      "Yes. Lila Player is free to download and free to use. There is no account, no subscription, no trial and no ads. The source code is MIT licensed, so you can read it, change it and redistribute it.",
  },
  {
    question: "Does it work offline?",
    answer:
      "Yes. All audio processing happens on your device. Once the desktop app is installed it never needs a network connection to open a file, slow it down, add reverb or export a WAV.",
  },
  {
    question: "What formats can I open?",
    answer:
      "Any audio file your system can decode. That normally covers MP3, WAV, M4A and AAC everywhere, plus formats like FLAC and OGG depending on your operating system. Decoding is handled by the audio decoder built into the system webview, so the exact list varies by platform.",
  },
  {
    question: "Can I export?",
    answer:
      "Yes. The Export button renders your current speed, reverb, tone and volume settings to an uncompressed WAV file. The render runs offline in a single pass rather than in real time, so it finishes faster than the length of the track. Vinyl crackle is a playback layer and is not included in the export.",
  },
  {
    question: "Does the pitch change when I slow a track?",
    answer:
      "Yes. Speed and pitch move together, so slowing a track also lowers its pitch. That is the sound most slowed and reverb edits use. Lila Player does not currently offer pitch-preserving time stretching.",
  },
  {
    question: "Why is the app not signed?",
    answer:
      "Code signing certificates from Apple and Microsoft are a recurring yearly cost, and Lila Player is an unpaid open source project, so the released binaries are unsigned. macOS and Windows will warn you the first time you open the app. The Installation help section lists the exact steps for each platform, and you can always build from source instead.",
  },
  {
    question: "Is there a web version?",
    answer:
      "Yes. The same player runs in your browser at https://ph33nx.github.io/lila-player/, with the same controls and the same WAV export. It processes audio in the browser and does not upload your files.",
  },
  {
    question: "How is this different from online slowed reverb tools?",
    answer:
      "Lila Player runs on your own machine instead of on someone else's server. There is nothing to upload and nothing to wait in a queue for, no account to create, no watermark, and no cap on file size or track length beyond your own memory. The export is an uncompressed WAV rather than a re-encoded download. Because the source is MIT licensed you can read exactly what the app does to your audio.",
  },
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const WebFaq = () => {
  if (!IS_WEB) return null;

  return (
    <section
      aria-labelledby="faq-heading"
      className="mx-auto w-full max-w-[880px] px-6 pb-16 tall:px-8"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <h2
        id="faq-heading"
        className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground"
      >
        FAQ
      </h2>
      <div className="divide-y divide-border border-y border-border">
        {faq.map((item) => (
          <details key={item.question} className="group py-3">
            <summary className="cursor-pointer list-none rounded-sm text-sm text-foreground marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <span className="mr-2 inline-block text-muted-foreground group-open:text-primary">
                &rsaquo;
              </span>
              {item.question}
            </summary>
            <p className="mt-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
};

export default WebFaq;
