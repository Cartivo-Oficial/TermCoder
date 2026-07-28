import { Clause, LegalPage, SELLER, CONTACT } from "@/components/site/legal";

export default function Privacy() {
  return (
    <LegalPage
      active="privacy"
      title="Privacy policy"
      intro="TermCoder is local-first, and this policy is short because we run almost no servers. We do not have a database of users, and we do not track you."
    >
      <Clause heading="The short version">
        <p>
          We do not run analytics, advertising or tracking scripts on this site. We do not store your sessions, your
          code or your study data on our servers — the app keeps them on your machine, and anything you choose to sync
          goes into your own private GitHub gist, which belongs to you.
        </p>
      </Clause>

      <Clause heading="Signing in">
        <p>
          Signing in is optional; the software works without an account. If you do sign in, you use GitHub or Google.
          Their sign-in returns your name, email address and avatar to a small Cloudflare Worker we run, which passes
          them straight back to your browser. That Worker keeps no database and stores nothing about you.
        </p>
        <p>
          Your session lives in your browser's local storage. Signing out deletes it. When you sign in with GitHub we
          also receive an access token limited to reading your profile, your email and your gists — it is used only by
          your browser, to read and write your own sync gist.
        </p>
      </Clause>

      <Clause heading="Syncing">
        <p>
          Settings, connectors, flashcard decks and study progress sync through a private gist in your own GitHub
          account. We never receive a copy. Delete the gist and the synced data is gone; nothing of it remains with us.
        </p>
      </Clause>

      <Clause heading="Buying Pro">
        <p>
          Payments are handled by Paddle, acting as merchant of record. Paddle collects the billing details needed for
          the transaction and applicable tax, and their privacy policy governs that data. We never see or store your
          card details.
        </p>
        <p>
          To issue your licence we ask Paddle whether the signed-in account has a completed purchase, and we sign a
          licence key containing your name, your email and the dates it covers. That key is handed to you; we keep no
          copy of it and no record of the purchase beyond what Paddle holds.
        </p>
      </Clause>

      <Clause heading="The agent and AI providers">
        <p>
          The agent runs on your machine. When it answers, your prompt and the file contents it decides to read are sent
          to whichever model provider you have configured — for example Anthropic, OpenAI, Google or a local model. That
          provider's own privacy policy applies to what it receives. We are not in the middle of that exchange and never
          see it.
        </p>
        <p>
          The agent asks before it writes files, runs commands or reaches the network, and read-only modes are
          available. What it may access is your decision.
        </p>
      </Clause>

      <Clause heading="Your rights">
        <p>
          Because we hold no user database, there is little for us to delete: signing out removes your session, and
          deleting your sync gist removes your synced data. For anything held by Paddle as merchant of record, or to ask
          a question about this policy, write to{" "}
          <a href={`mailto:${CONTACT}`} className="text-primary underline underline-offset-2">{CONTACT}</a>.
        </p>
        <p>This site is published by {SELLER}.</p>
      </Clause>
    </LegalPage>
  );
}
