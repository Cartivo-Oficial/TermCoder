import { Clause, LegalPage, SELLER, CONTACT } from "@/components/site/legal";

export default function Terms() {
  return (
    <LegalPage
      active="terms"
      title="Terms of service"
      intro="The software is open source and free. These terms cover the one thing that is sold — a TermCoder Pro licence — and what you can expect from it."
    >
      <Clause heading="Who you are dealing with">
        <p>
          TermCoder is published by {SELLER} ("we"). Questions about anything here go to{" "}
          <a href={`mailto:${CONTACT}`} className="text-primary underline underline-offset-2">{CONTACT}</a>.
        </p>
        <p>
          Payments are processed by Paddle.com Market Ltd, which acts as the merchant of record for every purchase.
          Paddle handles the transaction, tax and invoicing, and appears on your statement. Their buyer terms apply to
          the payment itself alongside these terms.
        </p>
      </Clause>

      <Clause heading="The software is free and open source">
        <p>
          The TermCoder agent, the desktop app, the command-line tool and the study tutor are released under the MIT
          licence. You may use, modify, fork and redistribute them — including commercially — under that licence. You
          do not need to buy anything to use them.
        </p>
      </Clause>

      <Clause heading="What a Pro licence gives you">
        <p>
          A Pro licence unlocks the features meant for whoever leads a room or a class: hosting a live room with more
          than one guest, running a classroom with a roster, assignments and grading, and syncing your sessions across
          machines.
        </p>
        <p>
          A licence costs one payment of 9 USD and is valid for one year from the date of purchase. It is not a
          subscription and does not renew or charge you again. When the year ends the Pro features stop; the free
          software keeps working exactly as before.
        </p>
        <p>
          The licence is personal and issued to the email address on your purchase. It covers the people you invite —
          guests joining your room or students in your classroom never need a licence of their own.
        </p>
      </Clause>

      <Clause heading="How the licence reaches you">
        <p>
          Delivery is digital and immediate. After checkout, your licence key appears in your account dashboard on this
          website; you paste it into the app under Settings to activate Pro. Nothing is shipped.
        </p>
        <p>
          Licence keys are cryptographically signed and verified by the app on your own machine. Activating a licence
          requires TermCoder 0.11.5 or newer.
        </p>
      </Clause>

      <Clause heading="Fair use">
        <p>
          Do not share, resell or publish your licence key, and do not try to forge or tamper with one. We may
          deactivate a licence obtained fraudulently or through a reversed payment.
        </p>
      </Clause>

      <Clause heading="What we do not promise">
        <p>
          The software is provided "as is", without warranty of any kind, as stated in the MIT licence. We do not
          guarantee that it is free of errors or that it will fit a particular purpose.
        </p>
        <p>
          TermCoder is an AI agent that reads and edits files and can run commands on your machine. You decide what it
          may touch, and you are responsible for reviewing its changes. Keep your work in version control or backed up.
        </p>
        <p>
          To the extent the law allows, our total liability for any claim relating to a Pro licence is limited to the
          amount you paid for it.
        </p>
      </Clause>

      <Clause heading="Changes and ending">
        <p>
          We may update these terms; the date at the top shows when they last changed. Changes never apply retroactively
          to a licence you already bought.
        </p>
        <p>
          You can stop using the software at any time. See our{" "}
          <a href="refunds.html" className="text-primary underline underline-offset-2">refund policy</a> if you want your
          money back, and our{" "}
          <a href="privacy.html" className="text-primary underline underline-offset-2">privacy policy</a> for what
          happens to your data.
        </p>
      </Clause>
    </LegalPage>
  );
}
