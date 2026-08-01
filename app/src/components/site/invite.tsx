import { Eyebrow, Heading } from "@/components/site/section";
import { ArrowLink } from "@/components/site/arrow-link";

const REPO = "https://github.com/Cartivo-Oficial/TermCoder";

const WAYS: [string, string, string][] = [
  ["Open an issue", `${REPO}/issues`, "A bug, a rough edge, a provider that behaves differently than the docs say."],
  ["Start a discussion", `${REPO}/discussions`, "Ideas, questions, and arguments about what the next release should carry."],
  ["Read the source", REPO, "Every claim on this page is a file. Start wherever you are most sceptical."],
];

// This is the slot a marketing page usually fills with testimonials. There is
// nobody to quote yet, and inventing quotes is not on the table, so the slot
// says what is actually true and hands over the two links that matter.
export function Invite() {
  return (
    <>
      <Eyebrow>Where the project is</Eyebrow>
      <Heading>Early, in the open, and better with you in it.</Heading>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="max-w-[58ch] space-y-4 text-[17px] leading-relaxed text-muted-foreground">
          <p>
            TermCoder has been built in the open since the first commit, and it is early. You will not find
            testimonials here, because there is nobody to quote yet — and a page that manufactures them has told
            you something about itself before you have run anything.
          </p>
          <p>
            What is here instead is the short path to the people building it. The issue tracker is the roadmap, the
            discussions are where the next release gets argued over, and both are open to you the moment you have
            an opinion. Early is not an apology; it is the only window in which what you say still changes the shape
            of the thing.
          </p>
        </div>
        <ul className="divide-y divide-border border-y border-border">
          {WAYS.map(([label, href, blurb]) => (
            <li key={label} className="py-5">
              <ArrowLink href={href} className="text-[16px]">{label}</ArrowLink>
              <p className="mt-2 max-w-[44ch] text-[14px] leading-relaxed text-muted-foreground">{blurb}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
