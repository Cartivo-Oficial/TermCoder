import { Clause, LegalPage, CONTACT } from "@/components/site/legal";
import { InlineLink } from "@/components/site/arrow-link";

export default function Refunds() {
  return (
    <LegalPage
      active="refunds"
      title="Refund policy"
      intro="Thirty days, no questions asked. If Pro is not what you hoped for, write to us and you get your money back."
    >
      <Clause heading="Thirty days, no questions">
        <p>
          If you are not happy with a TermCoder Pro licence, ask for a refund within 30 days of your purchase and we
          will refund it in full. You do not have to explain why.
        </p>
        <p>
          The software itself is free and open source, so nothing you rely on day to day disappears when a licence is
          refunded — only the Pro features stop.
        </p>
      </Clause>

      <Clause heading="How to ask">
        <p>
          Email{" "}
          <InlineLink href={`mailto:${CONTACT}`}>{CONTACT}</InlineLink> from the address you bought with, or use the
          receipt Paddle sent you. Say that you would like a refund; that is enough.
        </p>
        <p>
          We aim to reply within a few days. Once approved, Paddle — the merchant of record for the purchase — returns
          the money to the original payment method. How long it takes to appear depends on your bank or card issuer,
          usually a few business days.
        </p>
      </Clause>

      <Clause heading="After a refund">
        <p>
          The licence tied to that purchase stops being valid, and the Pro features are no longer available. You are
          welcome to buy again later.
        </p>
      </Clause>

      <Clause heading="After the thirty days">
        <p>
          A licence covers one year with a single payment and never renews, so there is no recurring charge to cancel
          and nothing to be surprised by. If something goes wrong outside the 30-day window — the licence will not
          activate, or you were charged twice — write to us anyway. We would rather fix it than leave you stuck.
        </p>
      </Clause>
    </LegalPage>
  );
}
