import { RiGithubFill } from "@remixicon/react";

// Where this version's source code lives. The AGPL licence requires a running copy to offer its own source,
// so this points at the fork that runs this version.
export const SOURCE_URL = "https://github.com/imperfys-byte/fortnite-chest-counter-but-better-claude-GPT-";

const LINKS = [
  {
    label: "Source code on GitHub",
    href: SOURCE_URL,
    icon: RiGithubFill,
  },
];

// Pinned to the bottom right corner of the page.
export function Links() {
  return (
    <nav
      aria-label="Links"
      className="fixed right-0 bottom-0 z-30 m-2 flex gap-1 rounded-lg bg-card/80 p-1 ring-1 ring-foreground/10 backdrop-blur"
    >
      {LINKS.map(({ label, href, icon: Icon }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          title={label}
          className="p-1.5 text-muted-foreground transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none"
        >
          <Icon className="size-5" />
        </a>
      ))}
    </nav>
  );
}
